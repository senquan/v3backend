interface RuleCondition {
  field: string;
  operator: string;
  value: string | string[];
}

interface RuleAction {
  discountRate: number;
  conditions: RuleCondition[];
}

export class FormulaConverter {
  private static parseCondition(field: string, values: string[], operator: string = "="): RuleCondition {
    return {
      field,
      operator,
      value: values
    };
  }

  private static createRule(conditions: RuleCondition[], discountRate: number): RuleAction {
    return {
      conditions,
      discountRate
    };
  }

  static convertToRules(formula: string): RuleAction[] {
    // 解析公式并转换为规则数组
    const rules: RuleAction[] = [];

    // 示例规则转换
    rules.push(
      // 系列排除规则
      this.createRule([
        this.parseCondition("series", ["公牛轨道插座"], "<>")
      ], 0.15),

      // G系列规则
      this.createRule([
        this.parseCondition("series", ["G59明装大板", "G28系列", "G09明装"])
      ], 0.10),

      // 隐藏式插座规则
      this.createRule([
        this.parseCondition("series", ["隐藏式插座"])
      ], 0.15),

      // 特定系列产品规则
      this.createRule([
        this.parseCondition("series", [
          "G07小面板", "G27加长", "G27定制", "有机玻璃", 
          "高晶玻璃", "G67磨砂玻璃", "全屋WIFI6", "置物架插座",
          "公牛漏电开关", "*电箱*", "*G36*", "G28轻智能",
          "语音开关", "语音插座"
        ])
      ], 0.15),

      // 特定型号产品规则
      this.createRule([
        this.parseCondition("model", [
          "*GD6*", "*LB-*", "*LE-*", "*LB12*", 
          "*LE12*", "*GD7*", "*GD8*"
        ])
      ], 0.15)
    );

    return rules;
  }

  static convertToDSL(rules: RuleAction[]): string {
    let dsl = '';
    rules.forEach((rule, index) => {
      dsl += `rule "discount_rule_${index + 1}" {\n`;
      dsl += '  when {\n';
      
      // 添加条件
      rule.conditions.forEach(condition => {
        if (Array.isArray(condition.value)) {
          const values = condition.value.map(v => `"${v}"`).join(' || ');
          dsl += `    ${condition.field} ${condition.operator} (${values})\n`;
        } else {
          dsl += `    ${condition.field} ${condition.operator} "${condition.value}"\n`;
        }
      });

      dsl += '  }\n';
      dsl += '  then {\n';
      dsl += `    apply_discount(${rule.discountRate})\n`;
      dsl += '  }\n';
      dsl += '}\n\n';
    });

    return dsl;
  }

  static convert(formula: string): string {
    const rules = this.convertToRules(formula);
    return this.convertToDSL(rules);
  }
}