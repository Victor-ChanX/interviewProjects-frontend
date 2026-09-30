// 键盘小工具。

/**
 * 输入框里按回车不要冒泡成整张表单的隐式提交（可搜索下拉：没有高亮选项时回车会提交表单 —— 前端 #12 修的已知问题）。
 * 挂在输入框外层的 onKeyDown 上：组件自己在输入框上的回车处理（选中高亮项）先跑，这里只拦掉浏览器的默认提交。
 * 返回是否拦下了。
 */
export function preventEnterSubmit(event: {
  key: string;
  preventDefault: () => void;
}): boolean {
  if (event.key !== "Enter") return false;

  event.preventDefault();

  return true;
}
