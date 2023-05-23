"use strict";

const LIST = 1;
const OP = 2;
const NUM = 3;
const VAR = 4;

const GASPRICES = {
  ADD: 3,
  SUB: 3,
  MUL: 5,
  DIV: 5,
  MOD: 5,
  LT: 3,
  GT: 3,
  LTE: 3,
  GTE: 3,
  ET: 3,
  TRANSFER: 15,
  BALANCE: 10,
  DEFINE: 3,
  GETMAP: 5,
  SETMAP: 7,
  HASMAP: 5,
  DELETEMAP: 7,
  IF: 8,
  REQUIRE: 8,
  BEGIN: 7,
  DEFINESTATE: 20, // Shoud be way more than this
};

module.exports = class SpartanScriptInterpreter {
  constructor(block, tx) {
    this.block = block;

    this.$me = tx.data.address;

    this.prevBalances = block.balances;
    this.currBalances = new Map(block.balances);

    this.gasLimit = tx.data.gasLimit;
    this.gasCurr = 0;

    this.prevContractStateVarible = block.contractStateVariables.get(
      tx.data.address
    );
    this.contractStateVariables = new Map(
      block.contractStateVariables.get(tx.data.address)
    );

    this.sender = tx.from;
    console.log(
      `The smart contract address is ${this.$me} and the sender address is ${this.sender}.`
    );

    this.globalEnv = null;
  }

  tokenize(contents) {
    let lines = contents.trim().split("\n");
    let tokens = [];
    lines.forEach((ln) => {
      ln = ln.replaceAll("(", " ( ").replaceAll(")", " ) ");

      ln = ln.replace(/;.*/, "");

      tokens.push(...ln.split(/\s+/).filter((s) => s.length !== 0));
    });
    return tokens;
  }

  parse(tokens) {
    let ast = { children: [] };
    for (let i = 0; i < tokens.length; i++) {
      let tok = tokens[i];
      if (tok === "(") {
        let newAst = { parent: ast, type: LIST, children: [] };
        ast.children.push(newAst);
        ast = newAst;
      } else if (tok === ")") {
        ast = ast.parent;
      } else if (tok.match(/^\d+$/)) {
        ast.children.push({ type: NUM, value: parseInt(tok) });
      } else if (tok.match(/^\w+$/)) {
        ast.children.push({ type: VAR, value: tok });
      } else {
        ast.children.push({ type: OP, value: tok });
      }
    }
    return ast.children;
  }

  printAST(ast) {
    console.log(
      `AST is ${JSON.stringify(ast, (key, value) => {
        if (key === "parent") return value.id;
        else return value;
      })}`
    );
  }

  evaluate(ast, env) {
    if (ast.type == NUM) {
      return ast.value;
    } else if (ast.value == "$me") {
      return this.$me;
    } else if (ast.value == "$sender") {
      return this.sender;
    } else if (ast.value == "$timestamp") {
      return this.contractStateVariables.get("$timestamp");
    } else if (ast.value == "makeMap") {
      return new Map();
    } else if (ast.value == "#t") {
      return ast.value;
    } else if (ast.value == "#f") {
      return ast.value;
    } else if (ast.type == VAR) {
      return this.hasVariable(env, ast.value);
    }

    let first = ast.children[0];
    let second = ast.children[1];
    let third = ast.children[2];
    let rest = ast.children.slice(2);

    if (this.gasCurr >= this.gasLimit) {
      throw new GasLimitReachedError(this.$me);
    }

    switch (first.value) {
      case "$balance":
        this.gasCurr += GASPRICES.BALANCE;
        if (second.value != "$me") {
          throw new Error(
            "Balance only accept one parameter having current context."
          );
        }
        let $me = this.evaluate(second, env);
        console.log(
          `The smart contract current balance is ${this.currBalances.get(
            $me
          )} for addrees ${$me}`
        );
        return this.currBalances.get($me);
      case "$transfer":
        this.gasCurr += GASPRICES.TRANSFER;
        let destination = this.evaluate(third, env);
        let amount = this.evaluate(second, env);
        console.log('TRANSFER', destination, amount);
        if (this.currBalances[this.$me] < parseInt(amount)) {
          throw new Error("Not enough balance.");
        }
        this.currBalances.set(
          destination,
          this.currBalances.get(destination) + amount
        );
        this.currBalances.set(
          this.$me,
          this.currBalances.get(this.$me) - amount
        );
        break;
      case "provide":
        env.provide.add(second.value);
        rest.forEach((val) => {
          env.provide.add(val.value);
        });
        break;
      case "define":
        this.gasCurr += GASPRICES.DEFINE;
        env.varMap.set(second.value, this.evaluate(third, env));
        break;
      case "defineState":
        this.gasCurr += GASPRICES.DEFINESTATE;
        this.contractStateVariables.set(
          second.value,
          this.evaluate(third, env)
        );
        break;
      case "lambda":
        let params = [];
        second.children.forEach((val) => {
          if (val.type != VAR) {
            throw new Error("Lambda should only contain params");
          }
          params.push(val.value);
        });
        return new FunctionDef(params, third, new ScopingEnvironment(env));
      case "set!":
        if (env.hasVar(second.value))
          env.setVar(second.value, this.evaluate(third, env));
        else if (this.contractStateVariables.has(second.value))
          this.contractStateVariables.set(
            second.value,
            this.evaluate(third, env)
          );
        else throw new Error(`The varible ${second.value} cannot be found.`);
        break;
      case "getMap":
        this.gasCurr += GASPRICES.GETMAP;
        if (second.type == VAR) {
          let res = this.hasVariable(env, second.value).get(
            this.evaluate(third, env)
          );
          return res;
        } else {
          return this.evaluate(second, env).get(this.evaluate(third, env));
        }
      case "setMap":
        this.gasCurr += GASPRICES.SETMAP;
        if (second.type == VAR) {
          return this.hasVariable(env, second.value).set(
            this.evaluate(third, env),
            this.evaluate(rest[1], env)
          );
        } else {
          let res = this.evaluate(second, env).set(
            this.evaluate(third, env),
            this.evaluate(rest[1], env)
          );
          return res;
        }
      case "hasMap":
        this.gasCurr += GASPRICES.HASMAP;
        return this.hasVariable(env, second.value).has(
          this.evaluate(third, env)
        )
          ? "#t"
          : "#f";
      case "deleteMap":
        this.gasCurr += GASPRICES.DELETEMAP;
        return this.hasVariable(env, second.value).delete(
          this.evaluate(third, env)
        )
          ? "#t"
          : "#f";
      case "display":
        console.log(this.evaluate(second, env));
        break;
      case "+":
        this.gasCurr += GASPRICES.ADD;
        return (
          rest.reduce((x, y) => x + this.evaluate(y, env), 0) +
          this.evaluate(second, env)
        );
      case "-":
        this.gasCurr += GASPRICES.SUB;
        return this.evaluate(third, env) - this.evaluate(second, env);
      case "*":
        this.gasCurr += GASPRICES.MUL;
        return (
          rest.reduce((x, y) => x + this.evaluate(y, env), 0) +
          this.evaluate(second, env)
        );
      case "/":
        this.gasCurr += GASPRICES.DIV;
        return this.evaluate(third, env) / this.evaluate(second, env);
      case "%":
        this.gasCurr += GASPRICES.MOD;
        return this.evaluate(second, env) % this.evaluate(third, env) || 0;
      case "<":
        this.gasCurr += GASPRICES.LT;
        return this.evaluate(second, env) < this.evaluate(third, env)
          ? "#t"
          : "#f";
      case ">":
        this.gasCurr += GASPRICES.GT;
        return this.evaluate(second, env) > this.evaluate(third, env)
          ? "#t"
          : "#f";
      case "==":
        this.gasCurr += GASPRICES.ET;
        return this.evaluate(second, env) == this.evaluate(third, env)
          ? "#t"
          : "#f";
      case ">=":
        this.gasCurr += GASPRICES.GTE;
        return this.evaluate(second, env) >= this.evaluate(third, env)
          ? "#t"
          : "#f";
      case "<=":
        this.gasCurr += GASPRICES.LTE;
        return this.evaluate(second, env) <= this.evaluate(third, env)
          ? "#t"
          : "#f";
      case "if":
        this.gasCurr += GASPRICES.IF;
        let cond = this.evaluate(second, env);
        if (cond == "#t") {
          return this.evaluate(third, env);
        } else if (cond == "#f") {
          return this.evaluate(rest[1], env);
        } else {
          throw new Error("The condition does not match to true or false.");
        }
      case "require":
        this.gasCurr += GASPRICES.REQUIRE;
        if (this.evaluate(second, env) == "#t") {
          break;
        } else {
          throw new Error("The require condition does not match.");
        }
      case "begin":
        this.gasCurr += GASPRICES.BEGIN;
        this.evaluate(second, env);
        for (let i = 0; i < rest.length - 1; i++) {
          this.evaluate(rest[i], env);
        }
        return this.evaluate(rest[rest.length - 1], env);
      default:
        if (typeof env.varMap.get(first.value) === "object") {
          // Check if method is allowed and in provide
          if (
            this.globalEnv.provide?.size > 0 &&
            !this.globalEnv.provide.has(first.value)
          ) {
            throw Error("Method not allowed, Try adding it in provide.");
          }

          let funcDef = env.varMap.get(first.value);

          if (funcDef.params.length >= 1) {
            funcDef.env.varMap.set(funcDef.params[0], second.value);

            // Handle multiple parameters
            if (rest.length != funcDef.params.length - 1) {
              throw Error("More than expected params in function.");
            }

            for (let i = 0; i < rest.length; i++) {
              funcDef.env.varMap.set(funcDef.params[i + 1], rest[i].value);
            }
          }

          return this.evaluate(funcDef.body, funcDef.env);
        }
    }
  }

  hasVariable(env, key) {
    if (env && env.hasVar(key)) return env.getVar(key);
    else if (this.contractStateVariables.has(key))
      return this.contractStateVariables.get(key);
    else throw new Error(`The varible ${key} not defined.`);
  }

  interpret(script, env = new ScopingEnvironment(null)) {
    this.globalEnv = env;
    let tokens = this.tokenize(script);
    let asts = this.parse(tokens);
    // console.log(this.printAST(asts));

    try {
      asts.forEach((ast) => {
        // this.printAST(ast, env);
        this.evaluate(ast, env);
        // console.log("Final value -> ", this.evaluate(ast, env), this.gasCurr);
      });
    } catch (error) {
      // Catch error when gas limit is reached
      if (error instanceof GasLimitReachedError) {
        return { gasUsed: this.gasLimit };
      }

      // Log other errors
      console.log(error);
    }

    for (let [key, value] of this.currBalances) {
      this.prevBalances.set(key, value);
    }
    for (let [key, value] of this.contractStateVariables) {
      this.prevContractStateVarible.set(key, value);
    }
    return { gasUsed: this.gasCurr };
  }
};

class ScopingEnvironment {
  constructor(parent) {
    this.varMap = new Map();
    this.parent = parent;
    this.provide = new Set();
  }

  hasVar(key) {
    if (this.varMap.has(key)) return true;
    if (this.parent !== null) return this.parent.hasVar(key);
    return false;
  }

  getVar(key) {
    // check in current scope else find in outer scope
    if (this.varMap.has(key)) return this.varMap.get(key);
    if (this.parent !== null) return this.parent.getVar(key);
    // throw new Error(`The variable ${key} is not declared.`);
    return null;
  }

  setVar(key, val) {
    if (this.varMap.has(key)) {
      this.varMap.set(key, val);
      return true;
    }
    if (this.parent !== null) {
      return this.parent.setVar(key, val);
    }
    throw new Error(`The variable ${key} can not be found.`);
  }
}

class FunctionDef {
  constructor(params, body, env) {
    this.params = params;
    this.body = body;
    this.env = env;
  }
}

class GasLimitReachedError extends Error {
  constructor(contract) {
    super(`${contract} has reached the gas limit.`);
  }
}
