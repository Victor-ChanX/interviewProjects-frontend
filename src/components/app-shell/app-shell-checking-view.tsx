// view：加载守卫静默续期期间的极简占位（无会话 → 先试一次 refresh 再决定跳不跳登录）。
// 只占住整屏背景色，不画壳：续期通常几十毫秒，画骨架反而会闪一下顶栏。

export function AppShellCheckingView() {
  return (
    <div
      className="min-h-screen bg-background"
      role="status"
      aria-busy="true"
      aria-label="正在恢复登录态"
    />
  );
}
