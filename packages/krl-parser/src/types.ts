export interface Loc {
  start: number;
  end: number;
}

export type TokenType =
  | "WHITESPACE"
  | "LINE-COMMENT"
  | "BLOCK-COMMENT"
  | "SYMBOL"
  | "NUMBER"
  | "STRING"
  | "REGEXP"
  | "CHEVRON-OPEN"
  | "CHEVRON-STRING"
  | "CHEVRON-BEESTING-OPEN"
  | "CHEVRON-BEESTING-CLOSE"
  | "CHEVRON-CLOSE"
  | "RAW"
  | "ILLEGAL"
  | "MISSING-CLOSE";

export interface Token {
  type: TokenType;
  src: string;
  loc: Loc;
  missingClose?: string;
}

interface BaseNode {
  type: string;
  loc: Loc;
}

export interface Number extends BaseNode {
  type: "Number";
  value: number;
}

export interface Boolean extends BaseNode {
  type: "Boolean";
  value: true | false;
}

export interface String extends BaseNode {
  type: "String";
  value: string;
}

export interface Chevron extends BaseNode {
  type: "Chevron";
  value: Node[];
}

export interface Keyword extends BaseNode {
  type: "Keyword";
  value: string;
}

export interface KrlRegExp extends BaseNode {
  type: "RegExp";
  value: RegExp;
}

export const RESERVED_WORDS_ENUM = {
  defaction: true,
  function: true,
  not: true,
  setting: true,
  null: true,
  true: true,
  false: true
};

export interface Identifier extends BaseNode {
  type: "Identifier";
  value: string;
}

export interface Declaration extends BaseNode {
  type: "Declaration";
  op: "=";
  left: Node;
  right: Node;
}

export interface Array extends BaseNode {
  type: "Array";
  value: Node[];
}

export interface RulesetID extends BaseNode {
  type: "RulesetID";
  value: string;
}

export interface Ruleset extends BaseNode {
  type: "Ruleset";
  rid: RulesetID;
  meta: RulesetMeta | null;
  global: Declaration[];
  rules: Rule[];
}

export interface RulesetMeta extends BaseNode {
  type: "RulesetMeta";
  properties: RulesetMetaProperty[];
}

export interface RulesetMetaProperty extends BaseNode {
  type: "RulesetMetaProperty";
  key: Keyword;
  value: any;
}

export interface Rule extends BaseNode {
  type: "Rule";
  name: Identifier;
  rule_state: "active" | "inactive";
  select: RuleSelect | null;
  foreach: RuleForEach[];
  prelude: Declaration[];
  action_block: ActionBlock | null;
  postlude: RulePostlude | null;
}

export interface RuleSelect extends BaseNode {
  type: "RuleSelect";
  kind: "when";
  event: EventExpression;
  within: EventWithin | null;
}

export interface EventExpression extends BaseNode {
  type: "EventExpression";
  event_domain: Identifier;
  event_type: Identifier;
  event_attrs: [];
  where: null;
  setting: [];
  aggregator: null;
}

export const TIME_PERIOD_ENUM = {
  day: true,
  days: true,
  hour: true,
  hours: true,
  minute: true,
  minutes: true,
  month: true,
  months: true,
  second: true,
  seconds: true,
  week: true,
  weeks: true,
  year: true,
  years: true
};

export interface EventWithin extends BaseNode {
  type: "EventWithin";
  expression: Node;
  time_period: keyof typeof TIME_PERIOD_ENUM;
}

export interface RuleForEach extends BaseNode {
  type: "RuleForEach";
  expression: Node;
  setting: Identifier[];
}

export interface ActionBlock extends BaseNode {
  type: "ActionBlock";
  // condition:get(data, condition_path, null),
  // block_type:get(data, type_path, "every"),
  // discriminant:get(data, discriminant_path, null),//i.e. `choose <expr> {...}`
  // actions:flatten([get(data, actions_path, null)]),
}

export interface RulePostlude extends BaseNode {
  type: "RulePostlude";
  // fired: get(data, fired_i, null),
  // notfired: get(data, notfired_i, null),
  // always: get(data, always_i, null),
}

export type Node =
  | Number
  | Boolean
  | String
  | Chevron
  | Keyword
  | KrlRegExp
  | Identifier
  | Declaration
  | Array
  | Ruleset
  | RulesetID
  | RulesetMeta
  | RulesetMetaProperty
  | Rule
  | RuleSelect
  | EventExpression
  | EventWithin
  | RuleForEach
  | ActionBlock
  | RulePostlude;
