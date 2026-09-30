// 新建群表单的校验权威（<form noValidate> + zodResolver）。规则与后端 POST /api/groups 同口径
// （src/api/routes/groups.ts：成员至少 1 个、不含群主、不重复），前端早一步给出中文提示；
// 账号是否 online 由后端判（422 ACCOUNT_NOT_ONLINE），表单只列 online 账号。
// memberAccountIds 的顺序就是勾选顺序：第一个成员会被提升为管理员。

import { z } from "zod";

export const createGroupSchema = z
  .object({
    creatorAccountId: z.string().min(1, "请选择群主"),
    memberAccountIds: z.array(z.string().min(1)).min(1, "至少选择 1 个成员"),
  })
  .superRefine((values, ctx) => {
    if (
      values.creatorAccountId &&
      values.memberAccountIds.includes(values.creatorAccountId)
    )
      ctx.addIssue({
        code: "custom",
        path: ["memberAccountIds"],
        message: "成员里不能包含群主",
      });

    if (
      new Set(values.memberAccountIds).size !== values.memberAccountIds.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["memberAccountIds"],
        message: "成员不能重复",
      });
  });

export type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

export const EMPTY_CREATE_GROUP_FORM: CreateGroupFormValues = {
  creatorAccountId: "",
  memberAccountIds: [],
};

/** 勾选 / 取消一个成员：新勾的排到最后，取消的原地移除，其余顺序不变（勾选顺序即提交顺序）。 */
export function toggleMember(
  selected: readonly string[],
  id: string,
): string[] {
  return selected.includes(id)
    ? selected.filter((item) => item !== id)
    : [...selected, id];
}
