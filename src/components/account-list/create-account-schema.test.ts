import { describe, expect, it } from "vitest";

import { createAccountSchema } from "@/components/account-list/create-account-schema";

describe("createAccountSchema", () => {
  it("accepts lowercase ids with digits, - and _, trimming spaces", () => {
    expect(createAccountSchema.parse({ id: " acc-6 " })).toEqual({
      id: "acc-6",
    });
    expect(createAccountSchema.parse({ id: "bot_2" })).toEqual({ id: "bot_2" });
  });

  it("rejects empty, uppercase, spaces, a leading dash and ids over 32 chars", () => {
    for (const id of ["", "Acc", "a b", "-a", "x".repeat(33)]) {
      const result = createAccountSchema.safeParse({ id });

      expect(result.success).toBe(false);

      if (!result.success)
        expect(result.error.issues[0]?.message).toBe(
          "只能用小写字母、数字、- 和 _，以字母或数字开头，最长 32 个字符",
        );
    }
  });
});
