import * as ast from "./types";
import { Token } from "./types";

// inspired by http://crockford.com/javascript/tdop/tdop.html

class ParseError extends Error {
  public token: Token;

  constructor(message: string, token: Token) {
    super(message);
    this.name = "ParseError";
    this.token = token;
  }
}

interface State {
  tokens: Token[];
  curr: {
    token_i: number;
    rule: Rule;
    token: Token;
  };
}

interface Rule {
  id: string;

  nud?: (state: State, token: Token) => ast.Node;

  lbp: number;
  led?: (state: State, token: Token, left: ast.Node) => ast.Node;

  sta?: (state: State) => ast.Node;
}

const rules: { [id: string]: Rule } = {};

function defRule(id: string, rule: Omit<Omit<Rule, "id">, "lbp">) {
  rules[id] = { id, lbp: 0, ...rule };

  if (!rules[id].lbp) {
    rules[id].lbp = 0;
  }
}

function advanceBase(
  tokens: Token[],
  token_i: number
): { token_i: number; token: Token; rule: Rule } {
  // get next token
  let token: Token | null = null;
  let found = false;
  while (token_i < tokens.length) {
    token = tokens[token_i];
    token_i += 1;

    if (token.type === "MISSING-CLOSE") {
      throw new ParseError("Missing close " + token.missingClose, token);
    }
    if (token.type === "ILLEGAL") {
      throw new ParseError("Unsupported characters", token);
    }
    if (
      token.type === "WHITESPACE" ||
      token.type === "LINE-COMMENT" ||
      token.type === "BLOCK-COMMENT"
    ) {
      continue;
    }

    found = true;
    break;
  }

  if (!token || (!found && token_i >= tokens.length)) {
    const index = tokens[tokens.length - 1].loc.end;
    return {
      token_i: tokens.length,
      token: {
        type: "WHITESPACE",
        src: "",
        loc: { start: index, end: index }
      },
      rule: rules["(end)"]
    };
  }

  let rule: Rule | null = null;
  if (rules.hasOwnProperty(token.src)) {
    rule = rules[token.src];
  } else if (rules.hasOwnProperty(token.type)) {
    rule = rules[token.type];
  }

  if (!rule) {
    throw new ParseError(
      "Unhandled token" + JSON.stringify(Object.keys(rules)),
      token
    );
  }

  return { token_i, token, rule };
}

function advance(state: State) {
  state.curr = advanceBase(state.tokens, state.curr.token_i);
}

function expression(state: State, rbp: number): ast.Node {
  let prev = state.curr;
  advance(state);
  if (!prev.rule.nud) {
    throw new ParseError("Expected an expression", prev.token);
  }
  let left = prev.rule.nud(state, prev.token);

  while (rbp < state.curr.rule.lbp) {
    prev = state.curr;
    advance(state);
    if (!prev.rule.led) {
      throw new ParseError(
        "Rule does not have a .led " + prev.rule.id,
        prev.token
      );
    }
    left = prev.rule.led(state, prev.token, left);
  }
  return left;
}

function assertSymbol(state: State, src: string) {
  if (state.curr.rule.id !== "SYMBOL" || state.curr.token.src !== src) {
    throw new ParseError("Expected: " + src, state.curr.token);
  }
}

function rulesetID(state: State): ast.RulesetID {
  if (state.curr.rule.id !== "SYMBOL") {
    throw new ParseError("Expected RulesetID", state.curr.token);
  }

  const parts: string[] = [];
  parts.push(state.curr.token.src);

  let start = state.curr.token.loc.start;
  let end = state.curr.token.loc.end;

  advance(state);

  while (true) {
    if (state.curr.token.type !== "RAW" || state.curr.token.src !== ".") {
      break;
    }
    // TODO advance with no skips
    advance(state);
    if (state.curr.rule.id !== "SYMBOL") {
      throw new ParseError("Expected RulesetID", state.curr.token);
    }
    parts.push(state.curr.rule.id);
    parts.push(state.curr.token.src);
    // TODO advance with no skips
    advance(state);
  }

  return {
    loc: { start, end },
    type: "RulesetID",
    value: parts.join(".")
  };
}

function ruleset(state: State): ast.Ruleset {
  assertSymbol(state, "ruleset");
  const start = state.curr.token.loc.start;
  advance(state);

  const rid = rulesetID(state);

  if (state.curr.rule.id !== "{" || state.curr.token.src !== "{") {
    throw new ParseError("Expected: {", state.curr.token);
  }
  advance(state);

  // TODO ruleset body

  const end = state.curr.token.loc.end;
  advance(state);

  return {
    loc: { start, end },
    type: "Ruleset",
    rid
  };
}

///////////////////////////////////////////////////////////////////////////////

defRule("(end)", {});

defRule("{", {});
defRule("}", {});

defRule("SYMBOL", {});

defRule("NUMBER", {
  nud(state, token) {
    return {
      loc: token.loc,
      type: "Number",
      value: parseFloat(token.src) || 0
    };
  }
});

defRule("STRING", {
  nud(state, token) {
    return {
      loc: token.loc,
      type: "String",
      value: token.src
        .replace(/(^")|("$)/g, "")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
    };
  }
});

defRule("REGEXP", {
  nud(state, token) {
    const pattern = token.src
      .substring(3, token.src.lastIndexOf("#"))
      .replace(/\\#/g, "#");
    const modifiers = token.src.substring(token.src.lastIndexOf("#") + 1);
    return {
      loc: token.loc,
      type: "RegExp",
      value: new RegExp(pattern, modifiers)
    };
  }
});

///////////////////////////////////////////////////////////////////////////////

export function parse(
  tokens: Token[],
  entryParse: (state: State) => ast.Node
): ast.Node {
  let state: State = {
    tokens: tokens,
    curr: advanceBase(tokens, 0)
  };

  const tree = entryParse(state);

  if (!state.curr) {
    throw new Error("Nothing was parsed");
  }
  if (state.curr.rule.id !== "(end)") {
    throw new ParseError(
      "Expected `(end)` but was " + state.curr.rule.id,
      state.curr.token
    );
  }
  advance(state);

  return tree;
}

export function parseExpression(tokens: Token[]): ast.Node {
  return parse(tokens, function(state) {
    return expression(state, 0);
  });
}

export function parseRuleset(tokens: Token[]): ast.Node {
  return parse(tokens, function(state) {
    return ruleset(state);
  });
}
