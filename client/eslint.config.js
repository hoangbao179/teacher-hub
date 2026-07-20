import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {ignores:['dist']},
  js.configs.recommended,
  {
    files:['**/*.{ts,tsx}'],languageOptions:{parser:tsparser,parserOptions:{ecmaVersion:2022,sourceType:'module'},globals:{window:'readonly',document:'readonly',localStorage:'readonly',fetch:'readonly',console:'readonly'}},
    plugins:{'@typescript-eslint':tseslint,'react-hooks':reactHooks,'react-refresh':reactRefresh},
    rules:{...reactHooks.configs.recommended.rules,'no-unused-vars':'off','no-undef':'off','react-refresh/only-export-components':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}
  }
];
