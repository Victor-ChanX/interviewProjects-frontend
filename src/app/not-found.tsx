import { Link } from "react-router";

export function Component() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-5xl font-semibold text-muted-foreground/40">404</p>
      <p className="text-sm text-muted-foreground">页面不存在</p>
      <Link
        to="/dashboard"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        回到工作台
      </Link>
    </div>
  );
}
