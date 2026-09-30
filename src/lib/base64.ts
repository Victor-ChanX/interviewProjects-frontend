// 字节 → base64（不带 data: 前缀）：「模拟外部发言」附图片时把文件编码进 JSON（前端 #24）。
// 分段 String.fromCharCode：一次展开整份几百 KB 的数组会撞调用栈上限。

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}
