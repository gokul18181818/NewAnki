declare module 'sql.js' {
  import initSqlJs from 'sql.js/dist/sql-asm.js';
  export default initSqlJs;
  export interface SqlJsStatic {
    Database: any;
  }
} 