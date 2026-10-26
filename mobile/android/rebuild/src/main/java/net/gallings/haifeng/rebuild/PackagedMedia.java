package net.gallings.haifeng.rebuild;

import android.content.res.AssetManager;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Local registered media only. No network, storage writes or story/playback decisions. */
final class PackagedMedia {
    private static final Pattern RANGE = Pattern.compile("bytes=([0-9]*)-([0-9]*)", Pattern.CASE_INSENSITIVE);
    private final AssetManager assets;
    private final Map<String, Media> files;

    private static final class Media {
        final long bytes;
        final String sha256;
        Media(long bytes, String sha256) { this.bytes = bytes; this.sha256 = sha256; }
    }

    PackagedMedia(AssetManager assets, JSONArray resources) throws Exception {
        this.assets = assets;
        Map<String, Media> registered = new HashMap<>();
        for (int index = 0; index < resources.length(); index++) {
            JSONObject resource = resources.getJSONObject(index);
            Object path = resource.get("path");
            Object bytes = resource.get("bytes");
            Object sha256 = resource.get("sha256");
            if (!(path instanceof String) || !mediaPath((String) path)
                    || !(bytes instanceof Integer || bytes instanceof Long)
                    || ((Number) bytes).longValue() < 0 || ((Number) bytes).longValue() > Integer.MAX_VALUE
                    || !(sha256 instanceof String) || !((String) sha256).matches("[a-f0-9]{64}")) {
                throw new IllegalArgumentException("资源登记无效：resources[" + index + "]");
            }
            Media file = new Media(((Number) bytes).longValue(), (String) sha256);
            Media previous = registered.put((String) path, file);
            // Several resource IDs may name the same physical media; do not merge their story identities.
            if (previous != null && (previous.bytes != file.bytes || !previous.sha256.equals(file.sha256))) {
                throw new IllegalArgumentException("同一媒体位置登记不一致：resources[" + index + "]");
            }
        }
        files = Collections.unmodifiableMap(registered);
    }

    private static boolean mediaPath(String path) {
        if (!path.startsWith("media/") || path.length() > 4096
                || path.indexOf('\\') >= 0 || path.indexOf('%') >= 0 || path.indexOf(':') >= 0
                || path.indexOf('?') >= 0 || path.indexOf('#') >= 0) return false;
        for (int index = 0; index < path.length(); index++) {
            if (Character.isISOControl(path.charAt(index))) return false;
        }
        for (String segment : path.split("/", -1)) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) return false;
        }
        return true;
    }

    WebResourceResponse serve(WebResourceRequest request, String path) {
        Media file = files.get(path);
        boolean head = "HEAD".equals(request.getMethod());
        if (file == null || !head && !"GET".equals(request.getMethod())) return empty(404, "Not Found", null);
        // WebView independently applies the original Range even to intercepted responses.
        // These forms cannot truthfully return an unsliced representation through this API.
        if (header(request, "If-Range") != null || head && header(request, "Range") != null) {
            return empty(400, "Unsupported Range Condition", null);
        }
        InputStream stream = null;
        try {
            // ACCESS_RANDOM also works for compressed assets; no temporary extraction or whole-file buffer.
            stream = assets.open("game/" + path, AssetManager.ACCESS_RANDOM);
            String range = head ? null : header(request, "Range");
            Span span = span(range, file.bytes);
            if (span.unsatisfied) {
                closeQuietly(stream);
                stream = null;
                return empty(416, "Range Not Satisfiable", file.bytes);
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", Long.toString(span.length));
            if (span.partial) headers.put("Content-Range",
                    "bytes " + span.start + "-" + (span.start + span.length - 1) + "/" + file.bytes);
            InputStream body;
            if (head) {
                closeQuietly(stream);
                stream = null;
                body = new MetadataInputStream(file.bytes);
            } else {
                skipFully(stream, span.start);
                body = new SliceInputStream(stream, span.start, span.length, file.bytes);
                stream = null; // Ownership passes to WebView, which closes each response body.
            }
            try {
                return new WebResourceResponse(mime(path), null, span.partial ? 206 : 200,
                        span.partial ? "Partial Content" : "OK", headers, body);
            } catch (RuntimeException error) {
                closeQuietly(body);
                throw error;
            }
        } catch (IOException error) {
            return empty(404, "Not Found", null);
        } finally {
            closeQuietly(stream);
        }
    }

    private static String header(WebResourceRequest request, String name) {
        Map<String, String> headers = request.getRequestHeaders();
        if (headers == null) return null;
        String result = null;
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (!name.equalsIgnoreCase(entry.getKey())) continue;
            // Multiple differently-cased entries are not interpreted as one range.
            if (result != null) return "";
            result = entry.getValue() == null ? "" : entry.getValue();
        }
        return result;
    }

    private static final class Span {
        final long start;
        final long length;
        final boolean partial;
        final boolean unsatisfied;
        Span(long start, long length, boolean partial, boolean unsatisfied) {
            this.start = start; this.length = length; this.partial = partial; this.unsatisfied = unsatisfied;
        }
    }

    /** Unsupported/malformed/multipart requests use the whole representation, never a guessed first range. */
    private static Span span(String value, long bytes) {
        Span full = new Span(0, bytes, false, false);
        if (value == null || value.length() > 256) return full;
        Matcher match = RANGE.matcher(value.trim());
        if (!match.matches()) return full;
        String first = match.group(1);
        String last = match.group(2);
        if (first.isEmpty() && last.isEmpty()) return full;
        if (first.isEmpty()) {
            long suffix = decimal(last);
            if (suffix == 0 || bytes == 0) return new Span(0, 0, false, true);
            long length = Math.min(suffix, bytes);
            return new Span(bytes - length, length, true, false);
        }
        if (!last.isEmpty() && compareDecimal(last, first) < 0) return full;
        long start = decimal(first);
        long end = last.isEmpty() ? Long.MAX_VALUE : decimal(last);
        if (start >= bytes) return new Span(0, 0, false, true);
        end = Math.min(end, bytes - 1);
        return new Span(start, end - start + 1, true, false);
    }

    private static int compareDecimal(String left, String right) {
        int fromLeft = 0;
        int fromRight = 0;
        while (fromLeft < left.length() - 1 && left.charAt(fromLeft) == '0') fromLeft++;
        while (fromRight < right.length() - 1 && right.charAt(fromRight) == '0') fromRight++;
        int length = Integer.compare(left.length() - fromLeft, right.length() - fromRight);
        return length != 0 ? length : left.substring(fromLeft).compareTo(right.substring(fromRight));
    }

    /** Valid decimal range positions can exceed signed long; saturate without wraparound. */
    private static long decimal(String value) {
        long result = 0;
        for (int index = 0; index < value.length(); index++) {
            int digit = value.charAt(index) - '0';
            if (result > (Long.MAX_VALUE - digit) / 10) return Long.MAX_VALUE;
            result = result * 10 + digit;
        }
        return result;
    }

    private static void skipFully(InputStream stream, long bytes) throws IOException {
        long remaining = bytes;
        while (remaining > 0) {
            long skipped = stream.skip(remaining);
            if (skipped > 0) remaining -= skipped;
            else {
                if (stream.read() < 0) throw new EOFException("登记媒体在范围起点前结束");
                remaining--;
            }
        }
    }

    private static String mime(String path) {
        int dot = path.lastIndexOf('.');
        String extension = dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
        switch (extension) {
            case "mp3": return "audio/mpeg";
            case "m4a": return "audio/mp4";
            case "ogg": case "oga": case "opus": return "audio/ogg";
            case "wav": return "audio/wav";
            case "flac": return "audio/flac";
            case "aac": return "audio/aac";
            default:
                String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                return type == null ? "application/octet-stream" : type;
        }
    }

    private static WebResourceResponse empty(int status, String reason, Long bytes) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Length", "0");
        if (bytes != null) {
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Range", "bytes */" + bytes);
        }
        return new WebResourceResponse("text/plain", "utf-8", status, reason, headers, new MetadataInputStream(0));
    }

    private static void closeQuietly(InputStream stream) {
        if (stream == null) return;
        try { stream.close(); } catch (IOException ignored) { /* No writable state or alternate source. */ }
    }

    /** WebView derives its own length/seek from available() before appending response headers. */
    private static final class MetadataInputStream extends InputStream {
        private final int length;
        MetadataInputStream(long length) { this.length = (int) length; }
        @Override public int available() { return length; }
        @Override public int read() { return -1; }
        @Override public long skip(long count) { return Math.max(0, count); }
    }

    /** Body is already positioned; acknowledge WebView's one initial seek without skipping twice. */
    private static final class SliceInputStream extends InputStream {
        private final InputStream source;
        private final long start;
        private final int representationLength;
        private long remaining;
        private boolean reading;
        private boolean acknowledgedSeek;
        private boolean closed;
        SliceInputStream(InputStream source, long start, long remaining, long representationLength) {
            this.source = source;
            this.start = start;
            this.remaining = remaining;
            this.representationLength = (int) representationLength;
        }
        private void requireOpen() throws IOException { if (closed) throw new IOException("媒体响应已关闭"); }

        @Override public int read() throws IOException {
            requireOpen();
            reading = true;
            if (remaining == 0) return -1;
            int value = source.read();
            if (value < 0) throw new EOFException("媒体短于登记范围");
            remaining--;
            return value;
        }
        @Override public int read(byte[] buffer) throws IOException { return read(buffer, 0, buffer.length); }
        @Override public int read(byte[] buffer, int offset, int length) throws IOException {
            if (buffer == null) throw new NullPointerException("buffer");
            if (offset < 0 || length < 0 || offset > buffer.length - length) throw new IndexOutOfBoundsException();
            requireOpen();
            if (length == 0) return 0;
            reading = true;
            if (remaining == 0) return -1;
            int count = source.read(buffer, offset, (int) Math.min(length, remaining));
            if (count < 0) throw new EOFException("媒体短于登记范围");
            remaining -= count;
            return count;
        }
        @Override public long skip(long count) throws IOException {
            requireOpen();
            if (count <= 0) return 0;
            if (!reading && !acknowledgedSeek && start > 0) {
                if (count != start) throw new IOException("WebView 初始媒体定位与登记范围不一致");
                acknowledgedSeek = true;
                return count;
            }
            long skipped = source.skip(Math.min(count, remaining));
            remaining -= skipped;
            return skipped;
        }
        @Override public int available() throws IOException {
            requireOpen();
            if (!reading) return representationLength;
            return (int) Math.min(remaining, source.available());
        }
        @Override public void close() throws IOException {
            if (closed) return;
            closed = true;
            source.close();
        }
    }
}
