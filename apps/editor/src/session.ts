/** Runtime HTML supplies one local-server token; a build never contains a usable token. */
export function editorSessionToken(): string {
  const fields = document.querySelectorAll('meta[name="haifeng-editor-session"]');
  const field = fields[0];
  if (fields.length !== 1 || !(field instanceof HTMLMetaElement) || !/^[a-f0-9]{64}$/u.test(field.content)) {
    throw new Error("编辑页缺少本次本机服务会话，请通过 editor:dev 或 editor:serve 打开，不要直接打开静态文件。");
  }
  return field.content;
}
