package net.gallings.haifeng.rebuild;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Strict JSON boundaries with raw value slices; never normalizes record numbers or UTF-16 escapes. */
final class NativeRecordJson {
    private static final int MAX_DEPTH = 64;
    private static final int MAX_MEMBERS = 4096;
    private final String source;
    private int offset;
    private int tokens;

    private NativeRecordJson(String source) {
        if (source == null) throw new IllegalArgumentException("缺少记录 JSON 字段");
        this.source = source;
    }

    static Map<String, String> object(String source) {
        NativeRecordJson parser = new NativeRecordJson(source);
        parser.space();
        Map<String, String> result = parser.object(0, true);
        parser.end();
        return result;
    }

    static void validate(String source) {
        NativeRecordJson parser = new NativeRecordJson(source);
        parser.value(0);
        parser.end();
    }

    static String string(String source) {
        NativeRecordJson parser = new NativeRecordJson(source);
        parser.space();
        String result = parser.string();
        parser.end();
        return result;
    }

    static long generation(String source) {
        if (source == null || !source.matches("0|[1-9][0-9]{0,15}")) {
            throw new IllegalArgumentException("存储代次必须是非负安全整数");
        }
        long value = Long.parseLong(source);
        if (value > NativeRecordStore.MAX_REVISION) throw new IllegalArgumentException("存储代次超过安全整数");
        return value;
    }

    /** JSON.stringify-compatible spelling for logical address components, including lone surrogates. */
    static String quote(String value) {
        StringBuilder result = new StringBuilder(value.length() + 2).append('"');
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            switch (current) {
                case '"': result.append("\\\""); break;
                case '\\': result.append("\\\\"); break;
                case '\b': result.append("\\b"); break;
                case '\f': result.append("\\f"); break;
                case '\n': result.append("\\n"); break;
                case '\r': result.append("\\r"); break;
                case '\t': result.append("\\t"); break;
                default:
                    if (Character.isHighSurrogate(current) && index + 1 < value.length()
                            && Character.isLowSurrogate(value.charAt(index + 1))) {
                        result.append(current).append(value.charAt(++index));
                    } else if (current < 0x20 || Character.isSurrogate(current)) {
                        result.append("\\u");
                        for (int shift = 12; shift >= 0; shift -= 4) {
                            result.append("0123456789abcdef".charAt((current >> shift) & 15));
                        }
                    } else result.append(current);
            }
        }
        return result.append('"').toString();
    }

    private void end() {
        space();
        if (offset != source.length()) throw invalid();
    }
    private IllegalArgumentException invalid() {
        return new IllegalArgumentException("记录 JSON 无效或超出结构限额，字符位置 " + offset);
    }
    private void space() {
        while (offset < source.length()) {
            char current = source.charAt(offset);
            if (current != ' ' && current != '\r' && current != '\n' && current != '\t') return;
            offset++;
        }
    }
    private boolean take(char expected) {
        if (offset >= source.length() || source.charAt(offset) != expected) return false;
        offset++;
        return true;
    }
    private void require(char expected) { if (!take(expected)) throw invalid(); }

    private void value(int depth) {
        space();
        if (depth > MAX_DEPTH || ++tokens > 1_000_000 || offset >= source.length()) throw invalid();
        char current = source.charAt(offset);
        if (current == '{') object(depth, false);
        else if (current == '[') {
            offset++;
            space();
            if (take(']')) return;
            do {
                value(depth + 1);
                space();
                if (take(']')) return;
                require(',');
            } while (true);
        } else if (current == '"') string();
        else if (current == 't') literal("true");
        else if (current == 'f') literal("false");
        else if (current == 'n') literal("null");
        else number();
    }

    private Map<String, String> object(int depth, boolean capture) {
        if (depth > MAX_DEPTH) throw invalid();
        require('{');
        space();
        Map<String, String> result = capture ? new LinkedHashMap<>() : null;
        Set<String> names = new HashSet<>();
        if (take('}')) return result;
        do {
            space();
            String name = string();
            if (names.size() >= MAX_MEMBERS || !names.add(name)) throw invalid();
            space();
            require(':');
            space();
            int start = offset;
            value(depth + 1);
            if (capture) result.put(name, source.substring(start, offset));
            space();
            if (take('}')) return result;
            require(',');
        } while (true);
    }

    private String string() {
        require('"');
        StringBuilder result = new StringBuilder();
        while (offset < source.length()) {
            char current = source.charAt(offset++);
            if (current == '"') return result.toString();
            if (current < 0x20) throw invalid();
            if (current == '\\') {
                if (offset >= source.length()) throw invalid();
                char escaped = source.charAt(offset++);
                switch (escaped) {
                    case '"': case '\\': case '/': result.append(escaped); break;
                    case 'b': result.append('\b'); break;
                    case 'f': result.append('\f'); break;
                    case 'n': result.append('\n'); break;
                    case 'r': result.append('\r'); break;
                    case 't': result.append('\t'); break;
                    case 'u':
                        int code = 0;
                        for (int digit = 0; digit < 4; digit++) {
                            if (offset >= source.length()) throw invalid();
                            char hex = source.charAt(offset++);
                            int value = hex >= '0' && hex <= '9' ? hex - '0'
                                    : hex >= 'a' && hex <= 'f' ? hex - 'a' + 10
                                    : hex >= 'A' && hex <= 'F' ? hex - 'A' + 10 : -1;
                            if (value < 0) throw invalid();
                            code = (code << 4) | value;
                        }
                        result.append((char) code);
                        break;
                    default: throw invalid();
                }
            } else if (Character.isHighSurrogate(current)) {
                if (offset >= source.length() || !Character.isLowSurrogate(source.charAt(offset))) throw invalid();
                result.append(current).append(source.charAt(offset++));
            } else {
                if (Character.isLowSurrogate(current)) throw invalid();
                result.append(current);
            }
        }
        throw invalid();
    }

    private void literal(String expected) {
        if (!source.startsWith(expected, offset)) throw invalid();
        offset += expected.length();
    }
    private boolean digit() { return offset < source.length() && source.charAt(offset) >= '0' && source.charAt(offset) <= '9'; }
    private void digits() {
        if (!digit()) throw invalid();
        while (digit()) offset++;
    }
    private void number() {
        take('-');
        if (!take('0')) digits();
        if (take('.')) digits();
        if (take('e') || take('E')) {
            if (!take('+')) take('-');
            digits();
        }
    }
}
