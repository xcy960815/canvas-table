module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "@vue/typescript/recommended",
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    // 关闭所有 Prettier 相关规则
    "prettier/prettier": "off",
    // 允许未使用的变量
    "@typescript-eslint/no-unused-vars": "warn",
    // 允许 any 类型
    "@typescript-eslint/no-explicit-any": "off",
    // 允许空函数
    "@typescript-eslint/no-empty-function": "off",
    // 允许非空断言
    "@typescript-eslint/no-non-null-assertion": "off",
    // 关闭 Vue 相关规则
    "vue/no-unused-components": "off",
    "vue/multi-word-component-names": "off",
    // 关闭所有格式相关规则
    "indent": "off",
    "quotes": "off",
    "semi": "off",
    "comma-dangle": "off",
    "space-before-function-paren": "off",
    "keyword-spacing": "off",
    "space-infix-ops": "off",
    "object-curly-spacing": "off",
    "array-bracket-spacing": "off",
    "comma-spacing": "off",
    "key-spacing": "off",
    "brace-style": "off",
    "eol-last": "off",
    "no-trailing-spaces": "off",
    "no-multiple-empty-lines": "off",
  },
};
