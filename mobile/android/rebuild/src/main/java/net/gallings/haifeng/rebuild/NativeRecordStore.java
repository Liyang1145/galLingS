package net.gallings.haifeng.rebuild;

import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import android.system.StructStat;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Unconnected Android file-record backend. A future explicit trial may create it off the UI thread.
 * Only trusted native assembly chooses its root/work. No WebView, story or domain merge lives here.
 */
final class NativeRecordStore implements AutoCloseable {
    static final long MAX_REVISION = 9_007_199_254_740_991L;
    private static final String FORMAT = "haifeng.native-record-table/1";
    private static final int MAX_RECORD_BYTES = 2 * 1024 * 1024;
    private static final int MAX_TABLE_BYTES = 32 * 1024 * 1024;
    private static final int MAX_RECORDS = 4096;
    private static final int MAX_FILES = 4096;
    // Android's Linux ABI defines O_CLOEXEC as 02000000, including API 24.
    // The Java constant is only public from API 27; keep the atomic open flag on older systems.
    private static final int OPEN_CLOSE_ON_EXEC = 0x80000;
    // Reserve before opening another descriptor: closing one can release this process's POSIX locks.
    private static final Set<String> LEASED_ROOTS = new HashSet<>();
    private final File root;
    private final String workId;
    private final NativeRecordAddress addresses;
    private final FileOutputStream lease;
    private final FileLock directoryLock;
    private long seen;
    private boolean closed;

    static final class StorageError extends RuntimeException {
        final String code;
        StorageError(String code, String message) { super(message); this.code = code; }
    }
    static final class ReadResult {
        final long revision;
        // null means missing. The JSON string "null" is a present, diagnostically invalid record.
        final String rawValue;
        final List<String> warnings;
        ReadResult(long revision, String rawValue, List<String> warnings) {
            this.revision = revision; this.rawValue = rawValue; this.warnings = immutable(warnings);
        }
    }
    static final class Entry {
        final String key;
        final String rawValue;
        Entry(String key, String rawValue) { this.key = key; this.rawValue = rawValue; }
    }
    static final class ScanResult {
        final long revision;
        final List<Entry> entries;
        final String next;
        final List<String> warnings;
        ScanResult(long revision, List<Entry> entries, String next, List<String> warnings) {
            this.revision = revision; this.entries = Collections.unmodifiableList(new ArrayList<>(entries));
            this.next = next; this.warnings = immutable(warnings);
        }
    }
    static final class WriteResult {
        final long revision;
        final boolean committed;
        final List<String> warnings;
        WriteResult(long revision, boolean committed, List<String> warnings) {
            this.revision = revision; this.committed = committed; this.warnings = immutable(warnings);
        }
    }
    private static final class Layout {
        final TreeMap<Long, File> commits = new TreeMap<>();
        int pending;
        int count;
    }
    private static final class Table {
        long revision;
        final TreeMap<String, String> entries;
        final Layout layout;
        Table(long revision, Map<String, String> entries, Layout layout) {
            this.revision = revision; this.entries = new TreeMap<>(entries); this.layout = layout;
        }
    }

    private NativeRecordStore(File root, String workId, NativeRecordAddress addresses,
            FileOutputStream lease, FileLock directoryLock) {
        this.root = root; this.workId = workId; this.addresses = addresses;
        this.lease = lease; this.directoryLock = directoryLock;
    }

    /** Creates no instance during ordinary IndexedDB startup. Caller must keep this off the UI thread. */
    static synchronized NativeRecordStore open(File requestedRoot, String workId) {
        NativeRecordAddress addresses;
        try { addresses = new NativeRecordAddress(workId); }
        catch (IllegalArgumentException invalid) { throw error("WORK", invalid.getMessage()); }
        FileOutputStream lease = null;
        String reservedRoot = null;
        try {
            File absolute = requestedRoot.getAbsoluteFile();
            File parent = absolute.getParentFile();
            if (parent == null || ".".equals(absolute.getName()) || "..".equals(absolute.getName())) {
                throw error("ROOT", "游戏目录须在受信任应用数据目录下");
            }
            // The trusted native caller owns the parent. Never follow a link at the selected root.
            File root = new File(parent.getCanonicalFile(), absolute.getName());
            try { Os.mkdir(root.getPath(), 0700); }
            catch (ErrnoException failure) { if (failure.errno != OsConstants.EEXIST) throw failure; }
            if (!OsConstants.S_ISDIR(Os.lstat(root.getPath()).st_mode)) {
                throw error("ROOT", "游戏记录根须为普通目录，不能是符号链接");
            }
            if (!LEASED_ROOTS.add(root.getPath())) throw error("LOCK", "当前进程已持有此游戏记录目录");
            reservedRoot = root.getPath();
            File lock = new File(root, "store.lock");
            FileDescriptor descriptor = openFile(lock.getPath(), OsConstants.O_RDWR | OsConstants.O_CREAT, 0600);
            lease = new FileOutputStream(descriptor);
            if (!OsConstants.S_ISREG(Os.fstat(descriptor).st_mode)) {
                throw error("LOCK", "游戏目录锁必须是普通文件");
            }
            FileLock exclusive = lease.getChannel().tryLock();
            if (exclusive == null) throw error("LOCK", "游戏记录目录已被其他宿主独占");
            return new NativeRecordStore(root, workId, addresses, lease, exclusive);
        } catch (IOException | ErrnoException | OverlappingFileLockException | StorageError failure) {
            boolean released = lease == null;
            if (lease != null) {
                try { lease.close(); released = true; }
                catch (IOException ignored) { /* Keep this process's reservation if descriptor release is uncertain. */ }
            }
            if (released && reservedRoot != null) LEASED_ROOTS.remove(reservedRoot);
            if (failure instanceof StorageError) throw (StorageError) failure;
            throw error("LOCK", "无法打开或独占游戏记录目录；已有文件保留，请关闭其他宿主后重试");
        }
    }

    synchronized ReadResult read(String key) {
        key(key);
        Table table = load();
        return new ReadResult(table.revision, table.entries.get(key), warnings(table.layout));
    }

    synchronized ScanResult scan(String prefix, String after, int limit) {
        if (!addresses.prefix(prefix) || limit < 1 || limit > 100
                || (after != null && (!after.startsWith(prefix) || !addresses.progress(after)))) {
            throw error("PAGE", "目录范围、游标或容量无效");
        }
        Table table = load();
        List<Entry> entries = new ArrayList<>();
        boolean more = false;
        // String.compareTo uses the same UTF-16 code-unit order as JavaScript logical addresses.
        for (Map.Entry<String, String> row : table.entries.entrySet()) {
            if (!row.getKey().startsWith(prefix) || (after != null && row.getKey().compareTo(after) <= 0)) continue;
            if (entries.size() == limit) { more = true; break; }
            entries.add(new Entry(row.getKey(), row.getValue()));
        }
        return new ScanResult(table.revision, entries, more ? entries.get(entries.size() - 1).key : null, warnings(table.layout));
    }

    synchronized WriteResult replaceProgress(String key, String rawValue) {
        if (!addresses.progress(key)) throw error("KEY", "此操作仅替换当前游戏进度槽位");
        value(key, rawValue);
        Table table = load();
        table.entries.put(key, rawValue);
        return commit(table);
    }

    synchronized WriteResult compareExchange(String key, long expected, String rawValue) {
        if (!addresses.record(key) || expected < 0 || expected > MAX_REVISION) {
            throw error("CAS", "仅登记的成果和偏好可使用安全存储代次更新");
        }
        value(key, rawValue);
        Table table = load();
        if (expected > table.revision) throw error("REVISION", "实际存储代次低于预期，拒绝覆盖旧容器");
        if (expected != table.revision) return new WriteResult(table.revision, false, warnings(table.layout));
        table.entries.put(key, rawValue);
        return commit(table);
    }

    private void key(String key) {
        if (!addresses.contains(key)) throw error("KEY", "记录地址不属于当前作品已登记的游戏范围");
    }
    private void value(String key, String raw) {
        key(key);
        if (raw == null || raw.length() > MAX_RECORD_BYTES || encode(raw).length > MAX_RECORD_BYTES) {
            throw error("CAPACITY", "单条记录超过 2 MiB 或缺少 JSON；未截断原记录");
        }
        try {
            if (!addresses.matches(key, raw)) throw error("FAMILY", "记录封装与目标地址种类不一致");
        } catch (IllegalArgumentException invalid) { throw error("VALUE", invalid.getMessage()); }
    }

    private Layout layout() {
        if (closed || !directoryLock.isValid()) throw error("LOCK", "游戏记录实例已经关闭或失去目录锁");
        try {
            if (!OsConstants.S_ISDIR(Os.lstat(root.getPath()).st_mode)) throw error("ROOT", "游戏记录根已不再是普通目录");
            String[] names = root.list();
            if (names == null) throw error("IO", "无法列举游戏记录目录");
            if (names.length > MAX_FILES) throw error("CAPACITY", "游戏记录目录超过 4096 个文件，未清空数据");
            Layout result = new Layout();
            result.count = names.length;
            for (String name : names) {
                File file = new File(root, name);
                int mode = Os.lstat(file.getPath()).st_mode;
                boolean regular = OsConstants.S_ISREG(mode);
                boolean directory = OsConstants.S_ISDIR(mode);
                if (!regular && !directory) throw error("LAYOUT", "游戏记录目录包含链接或特殊文件，未自动处理");
                if ("store.lock".equals(name) && regular) continue;
                if (name.matches("pending-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.tmp")) {
                    result.pending++;
                    continue;
                }
                if (directory && name.matches("records-[0-9]{20}")) {
                    String[] children = file.list();
                    File payload = new File(file, "record.json");
                    if (children == null || children.length != 1 || !"record.json".equals(children[0])
                            || !OsConstants.S_ISREG(Os.lstat(payload.getPath()).st_mode)) {
                        throw error("LAYOUT", "已提交记录目录不是完整的单文件容器");
                    }
                    file = payload;
                } else if (!regular || !name.matches("records-[0-9]{20}\\.json")) {
                    throw error("LAYOUT", "游戏记录目录包含未知文件");
                }
                long revision;
                try { revision = Long.parseLong(name.substring(8, 28)); }
                catch (NumberFormatException invalid) { throw error("REVISION", "容器文件名中的代次无效"); }
                if (revision < 1 || revision > MAX_REVISION) throw error("REVISION", "容器文件名中的代次越界");
                if (result.commits.put(revision, file) != null) throw error("REVISION", "同一代次存在多个提交，拒绝猜测");
            }
            if (!new File(root, "store.lock").exists()) throw error("LOCK", "目录锁文件已丢失");
            return result;
        } catch (ErrnoException failure) { throw error("IO", "无法确认游戏目录文件属性"); }
    }

    private Table load() {
        Layout layout = layout();
        Table table = layout.commits.isEmpty() ? new Table(0, Collections.emptyMap(), layout)
                : table(layout.commits.lastEntry().getValue(), layout.commits.lastKey(), layout);
        if (table.revision < seen) throw error("REVISION", "存储代次发生倒退，未采用旧容器");
        seen = table.revision;
        return table;
    }

    private Table table(File file, long expected, Layout layout) {
        try {
            Map<String, String> fields = NativeRecordJson.object(readFile(file));
            if (fields.size() != 4 || !fields.keySet().containsAll(Arrays.asList("format", "workId", "revision", "entries"))
                    || !FORMAT.equals(NativeRecordJson.string(fields.get("format")))
                    || !workId.equals(NativeRecordJson.string(fields.get("workId")))
                    || NativeRecordJson.generation(fields.get("revision")) != expected) {
                throw error("TABLE", "容器格式、作品或代次不匹配；未回落到旧提交");
            }
            Map<String, String> entries = NativeRecordJson.object(fields.get("entries"));
            if (entries.size() > MAX_RECORDS) throw error("CAPACITY", "容器记录超过 4096 个地址");
            for (Map.Entry<String, String> row : entries.entrySet()) {
                key(row.getKey());
                if (encode(row.getValue()).length > MAX_RECORD_BYTES) throw error("CAPACITY", "容器内单条记录超过 2 MiB");
            }
            // Preserve valid JSON of an invalid domain record, including null, for TypeScript diagnostics.
            return new Table(expected, entries, layout);
        } catch (IllegalArgumentException invalid) { throw error("TABLE", invalid.getMessage()); }
    }

    private WriteResult commit(Table table) {
        if (table.revision >= MAX_REVISION) throw error("REVISION", "存储代次已耗尽，未覆盖旧记录");
        if (table.entries.size() > MAX_RECORDS || table.layout.count > MAX_FILES - 2) {
            throw error("CAPACITY", "记录或目录容量不足；未删除旧提交");
        }
        long revision = table.revision + 1;
        StringBuilder json = new StringBuilder("{\"format\":").append(NativeRecordJson.quote(FORMAT))
                .append(",\"workId\":").append(NativeRecordJson.quote(workId))
                .append(",\"revision\":").append(revision).append(",\"entries\":{");
        boolean first = true;
        for (Map.Entry<String, String> row : table.entries.entrySet()) {
            if (!first) json.append(',');
            first = false;
            json.append(NativeRecordJson.quote(row.getKey())).append(':').append(row.getValue());
            if (json.length() > MAX_TABLE_BYTES) throw error("CAPACITY", "记录容器超过 32 MiB，未截断数据");
        }
        byte[] bytes = encode(json.append("}}").toString());
        if (bytes.length > MAX_TABLE_BYTES) throw error("CAPACITY", "记录容器超过 32 MiB，未截断数据");
        File temporary = new File(root, "pending-" + UUID.randomUUID() + ".tmp");
        File destination = new File(root, String.format(Locale.ROOT, "records-%020d", revision));
        List<String> warnings = warnings(table.layout);
        try {
            Os.mkdir(temporary.getPath(), 0700);
            FileDescriptor descriptor = openFile(new File(temporary, "record.json").getPath(),
                    OsConstants.O_WRONLY | OsConstants.O_CREAT | OsConstants.O_EXCL, 0600);
            try (FileOutputStream stream = new FileOutputStream(descriptor)) {
                stream.write(bytes);
                stream.getFD().sync();
            }
            syncDirectory(temporary, warnings, revision);
            // Apps cannot rely on hard-link permission. Publish a complete nonempty directory:
            // rename cannot replace another nonempty committed directory or a legacy regular file.
            Os.rename(temporary.getPath(), destination.getPath());
        } catch (IOException | ErrnoException failure) {
            throw error("IO", "记录未完成写入、同步或提交；旧提交保留，未自动采用临时文件");
        }
        seen = revision;
        // All following failures are warnings: the complete destination is already the new commit.
        syncDirectory(root, warnings, revision);
        for (Map.Entry<Long, File> older : table.layout.commits.entrySet()) {
            if (older.getKey() >= revision - 1) continue;
            try {
                table(older.getValue(), older.getKey(), table.layout);
                File payload = older.getValue();
                if (payload.getParentFile().equals(root)) Os.remove(payload.getPath());
                else {
                    // Retire the complete directory before cleanup; an interrupted cleanup
                    // remains pending and must never resemble a damaged committed generation.
                    File retired = new File(root, "pending-" + UUID.randomUUID() + ".tmp");
                    Os.rename(payload.getParentFile().getPath(), retired.getPath());
                    Os.remove(new File(retired, "record.json").getPath());
                    Os.remove(retired.getPath());
                }
            } catch (StorageError | ErrnoException failure) {
                warnings.add("提交 " + older.getKey() + " 的旧容器清理未完成；当前提交 " + revision + " 仍已保存");
            }
        }
        syncDirectory(root, warnings, revision);
        return new WriteResult(revision, true, warnings);
    }

    private void syncDirectory(File directory, List<String> warnings, long revision) {
        FileDescriptor descriptor = null;
        try {
            descriptor = openFile(directory.getPath(), OsConstants.O_RDONLY, 0);
            if (!OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode)) {
                throw new ErrnoException("fsync", OsConstants.ENOTDIR);
            }
            Os.fsync(descriptor);
        } catch (ErrnoException failure) {
            warnings.add("提交 " + revision + " 已可读取，但目录同步未确认；不承诺断电持久性");
        } finally {
            if (descriptor != null) {
                try { Os.close(descriptor); }
                catch (ErrnoException failure) { warnings.add("提交 " + revision + " 后目录句柄关闭报告异常"); }
            }
        }
    }

    private static String readFile(File file) {
        try {
            FileDescriptor descriptor = openFile(file.getPath(), OsConstants.O_RDONLY, 0);
            try (FileInputStream stream = new FileInputStream(descriptor)) {
                StructStat metadata = Os.fstat(descriptor);
                if (!OsConstants.S_ISREG(metadata.st_mode) || metadata.st_size > MAX_TABLE_BYTES) {
                    throw error("CAPACITY", "记录容器不是普通文件或超过 32 MiB");
                }
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (bytes.size() > MAX_TABLE_BYTES - count) throw error("CAPACITY", "读取的记录容器超过 32 MiB");
                    bytes.write(buffer, 0, count);
                }
                return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
            }
        } catch (IOException | ErrnoException failure) {
            throw error("IO", "无法完整读取最新容器或 UTF-8 无效；未回落旧提交或初始化空表");
        }
    }

    private static byte[] encode(String value) {
        try {
            ByteBuffer bytes = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(value));
            byte[] result = new byte[bytes.remaining()];
            bytes.get(result);
            return result;
        } catch (CharacterCodingException invalid) {
            throw error("VALUE", "记录含有未转义的无配对 UTF-16 单元，拒绝有损编码");
        }
    }
    private static FileDescriptor openFile(String path, int flags, int mode) throws ErrnoException {
        return Os.open(path, flags | OsConstants.O_NOFOLLOW | OPEN_CLOSE_ON_EXEC, mode);
    }
    private static List<String> warnings(Layout layout) {
        List<String> result = new ArrayList<>();
        if (layout.pending > 0) result.add("保留了 " + layout.pending + " 个未提交临时文件；它们不作为已保存记录读取");
        return result;
    }
    private static List<String> immutable(List<String> values) {
        return Collections.unmodifiableList(new ArrayList<>(values));
    }
    private static StorageError error(String suffix, String message) { return new StorageError("NATIVE_STORAGE_" + suffix, message); }

    @Override public synchronized void close() {
        if (closed) return;
        closed = true;
        try {
            lease.close();
            synchronized (NativeRecordStore.class) { LEASED_ROOTS.remove(root.getPath()); }
        }
        catch (IOException failure) { throw error("LOCK", "关闭游戏记录目录锁失败；请重开宿主"); }
    }
}
