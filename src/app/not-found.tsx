import { Link } from "react-router";

export function Component() {
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      <p className="text-sm text-muted-foreground">页面不存在</p>
      <Link to="/accounts" className="text-sm underline underline-offset-4">
        回到账号列表
      </Link>
    </div>
  );
}
