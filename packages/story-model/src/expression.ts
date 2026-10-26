import { ContentError } from "./model.ts";
import type { Assignment, BinaryOperator, Expression, SourceLocation, Value, ValueType } from "./model.ts";

const IDENTIFIER = /^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/u;
const TOKEN = /\s*(\d+(?:\.\d+)?|"[^"]*"|'[^']*'|[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*|>=|<=|==|!=|&&|\|\||[-+*/()<>!])/uy;
const PRECEDENCE: Partial<Record<string, number>> = {
  "||": 1, "&&": 2, "==": 3, "!=": 3, ">": 3, "<": 3, ">=": 3, "<=": 3,
  "+": 4, "-": 4, "*": 5, "/": 5,
};
export type VariableTypes = Readonly<Record<string, ValueType>>;

function fail(message: string, source: SourceLocation): never {
  throw new ContentError("EXPRESSION", message, source);
}

export function expressionType(expression: Expression, types: VariableTypes, source: SourceLocation): ValueType {
  if (expression.kind === "literal") return typeof expression.value as ValueType;
  if (expression.kind === "variable") {
    if (!Object.hasOwn(types, expression.name)) return fail(`未声明变量「${expression.name}」`, source);
    return types[expression.name]!;
  }
  if (expression.kind === "unary") {
    const operand = expressionType(expression.operand, types, source);
    if (expression.operator === "!") return "boolean";
    if (operand !== "number") return fail("负号只接受数值", source);
    return "number";
  }
  const left = expressionType(expression.left, types, source);
  const right = expressionType(expression.right, types, source);
  const op = expression.operator;
  if (op === "&&" || op === "||") return "boolean";
  if (op === "==" || op === "!=") {
    if (left !== right) return fail("比较两侧类型必须一致", source);
    return "boolean";
  }
  if (["<", ">", "<=", ">="].includes(op)) {
    if (left !== "number" || right !== "number") return fail("大小比较只接受数值", source);
    return "boolean";
  }
  if (op === "+" && left === "string" && right === "string") return "string";
  if (left !== "number" || right !== "number") return fail(`运算「${op}」不接受隐式类型转换`, source);
  return "number";
}

/** Parse author text once; runtime consumes the resulting restricted tree. */
export function parseExpression(text: string, types: VariableTypes, source: SourceLocation): Expression {
  const input = text.trim();
  if (!input) return { kind: "literal", value: true };
  if (input.length > 4096) return fail("表达式超过 4096 字符", source);
  const tokens: string[] = [];
  const re = new RegExp(TOKEN);
  let offset = 0;
  while (offset < input.length) {
    re.lastIndex = offset;
    const match = re.exec(input);
    if (!match) return fail(`无法识别表达式第 ${offset + 1} 个字符`, source);
    tokens.push(match[1]!);
    offset = re.lastIndex;
  }
  let cursor = 0;
  let depth = 0;
  function unary(): Expression {
    if (++depth > 128) return fail("表达式嵌套超过 128 层", source);
    const token = tokens[cursor++];
    let result: Expression;
    if (token === "!" || token === "-") {
      result = { kind: "unary", operator: token, operand: unary() };
    } else if (token === "(") {
      result = binary(1);
      if (tokens[cursor++] !== ")") return fail("缺少右括号", source);
    } else if (token === undefined) {
      return fail("表达式不完整", source);
    } else if (/^\d/u.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) return fail("数值不是有限数", source);
      result = { kind: "literal", value };
    } else if (/^["']/u.test(token)) {
      result = { kind: "literal", value: token.slice(1, -1) };
    } else if (token === "true" || token === "false") {
      result = { kind: "literal", value: token === "true" };
    } else if (IDENTIFIER.test(token)) {
      result = { kind: "variable", name: token };
    } else {
      return fail(`多余符号「${token}」`, source);
    }
    depth--;
    return result;
  }
  function binary(minimum: number): Expression {
    let left = unary();
    while (true) {
      const token = tokens[cursor];
      const priority = token !== undefined && Object.hasOwn(PRECEDENCE, token) ? PRECEDENCE[token] : undefined;
      if (priority === undefined || priority < minimum) break;
      cursor++;
      const right = binary(priority + 1);
      left = { kind: "binary", operator: token as BinaryOperator, left, right };
    }
    return left;
  }
  const expression = binary(1);
  if (cursor !== tokens.length) return fail(`多余内容「${tokens.slice(cursor).join(" ")}」`, source);
  expressionType(expression, types, source);
  return expression;
}

export function parseAssignments(text: string, writable: VariableTypes, readable: VariableTypes, source: SourceLocation): Assignment[] {
  // Split outside quotes; author string literals may contain punctuation.
  const statements: string[] = [];
  let quote = "";
  let start = 0;
  for (let index = 0; index <= text.length; index++) {
    const char = text[index];
    if (char === "'" || char === '"') {
      if (!quote) quote = char;
      else if (quote === char) quote = "";
    }
    if (index === text.length || (!quote && (char === ";" || char === "；" || char === "\n"))) {
      const statement = text.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  return statements.map(statement => {
    const match = /^([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*(\+=|-=|=)\s*(.+)$/u.exec(statement);
    if (!match) return fail(`无法识别变量动作「${statement}」`, source);
    const name = match[1]!;
    const operator = match[2] as Assignment["operator"];
    if (!Object.hasOwn(writable, name)) return fail(`不可写或未声明变量「${name}」`, source);
    const expression = parseExpression(match[3]!, readable, source);
    const type = expressionType(expression, readable, source);
    if (writable[name] !== type || (operator !== "=" && type !== "number")) {
      return fail(`变量「${name}」的赋值类型不匹配`, source);
    }
    return { name, operator, expression };
  });
}

export function truthy(value: Value): boolean {
  return value !== false && value !== 0 && value !== "";
}

export function evaluate(expression: Expression, values: Readonly<Record<string, Value>>): Value {
  const number = (value: Value): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("表达式需要有限数值");
    return value;
  };
  const finite = (value: number): number => {
    if (!Number.isFinite(value)) throw new Error("表达式产生非有限数值");
    return value;
  };
  if (expression.kind === "literal") return expression.value;
  if (expression.kind === "variable") {
    if (!Object.hasOwn(values, expression.name)) throw new Error(`缺少变量「${expression.name}」`);
    return values[expression.name]!;
  }
  if (expression.kind === "unary") {
    const value = evaluate(expression.operand, values);
    return expression.operator === "!" ? !truthy(value) : finite(-number(value));
  }
  // Evaluate both operands, matching the old restricted parser's eager logic.
  const left = evaluate(expression.left, values);
  const right = evaluate(expression.right, values);
  switch (expression.operator) {
    case "&&": return truthy(left) && truthy(right);
    case "||": return truthy(left) || truthy(right);
    case "==": return left === right;
    case "!=": return left !== right;
    case ">": return number(left) > number(right);
    case "<": return number(left) < number(right);
    case ">=": return number(left) >= number(right);
    case "<=": return number(left) <= number(right);
    case "+":
      return typeof left === "string" && typeof right === "string"
        ? left + right : finite(number(left) + number(right));
    case "-": return finite(number(left) - number(right));
    case "*": return finite(number(left) * number(right));
    case "/":
      if (number(right) === 0) throw new Error("除零");
      return finite(number(left) / number(right));
  }
}

/** Mutates only a caller-owned candidate state, never the live runtime state. */
export function applyAssignments(actions: readonly Assignment[], values: Record<string, Value>): void {
  for (const action of actions) {
    if (!Object.hasOwn(values, action.name)) throw new Error(`缺少可写变量「${action.name}」`);
    const result = evaluate(action.expression, values);
    const old = values[action.name]!;
    if (typeof result !== typeof old) throw new Error(`变量「${action.name}」的值类型不匹配`);
    if (action.operator === "=") values[action.name] = result;
    else {
      if (typeof old !== "number" || typeof result !== "number") throw new Error("增减只支持数值");
      const value = action.operator === "+=" ? old + result : old - result;
      if (!Number.isFinite(value)) throw new Error("变量产生非有限数值");
      values[action.name] = value;
    }
  }
}
