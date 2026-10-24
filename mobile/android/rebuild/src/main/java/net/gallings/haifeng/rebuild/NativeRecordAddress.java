package net.gallings.haifeng.rebuild;

import java.util.LinkedHashMap;
import java.util.Map;

/** Registered logical keys only. No key ever becomes a filesystem path. */
final class NativeRecordAddress {
    private static final String SAVE = "haifeng.save/1";
    private final String[] progress;
    private final Map<String, String> records = new LinkedHashMap<>();

    NativeRecordAddress(String workId) {
        if (workId == null || workId.trim().isEmpty() || workId.length() > 128) {
            throw new IllegalArgumentException("作品身份需要 1～128 个 UTF-16 单元");
        }
        String work = NativeRecordJson.quote(workId);
        progress = new String[] {
            "[\"" + SAVE + "\"," + work + ",\"development\",\"normal-entry\",",
            "[\"" + SAVE + "\"," + work + ",\"preview\",\"timed-choice:pm8x8v2h\",",
        };
        for (String family : new String[] { "haifeng.player-records/1", "haifeng.audio-preferences/1",
                "haifeng.reading-preferences/1", "haifeng.button-preferences/1", "haifeng.readout-preferences/1" }) {
            records.put("[\"" + family + "\"," + work + ",\"development\",\"normal-entry\"]", family);
        }
    }

    boolean progress(String key) {
        if (key == null || key.length() > 4096 || !key.endsWith("]")) return false;
        for (String prefix : progress) {
            if (!key.startsWith(prefix)) continue;
            try {
                String literal = key.substring(prefix.length(), key.length() - 1);
                if (!literal.startsWith("\"") || !literal.endsWith("\"")) return false;
                String slot = NativeRecordJson.string(literal);
                return !slot.isEmpty() && slot.length() <= 128;
            } catch (IllegalArgumentException invalid) { return false; }
        }
        return false;
    }
    boolean record(String key) { return records.containsKey(key); }
    boolean contains(String key) { return record(key) || progress(key); }
    boolean prefix(String prefix) {
        for (String allowed : progress) if (allowed.equals(prefix)) return true;
        return false;
    }
    boolean matches(String key, String raw) {
        Map<String, String> object = NativeRecordJson.object(raw);
        String format = object.get("format");
        return format != null && (progress(key) ? SAVE : records.get(key)).equals(NativeRecordJson.string(format));
    }
}
