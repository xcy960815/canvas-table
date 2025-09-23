import type { PropType } from 'vue'

const defaultFontFamily = 'Arial, sans-serif'

export const chartProps = {
  // ========== 数据相关 Props ==========
  /**
   * 图表标题
   */
  title: String,

  /**
   * 数据
   */
  data: {
    type: Array as PropType<ChartDataVo.ChartData[]>,
    required: true,
    default: () => []
  },

  /**
   * 分组字段
   */
  xAxisFields: {
    type: Array as PropType<GroupStore.GroupOption[]>,
    required: true,
    default: () => []
  },

  /**
   * 维度字段
   */
  yAxisFields: {
    type: Array as PropType<DimensionStore.DimensionOption[]>,
    required: true,
    default: () => []
  },

  // ========== 功能相关 Props ==========
  /**
   * 是否启用汇总
   */
  enableSummary: { type: Boolean, default: false },
  /**
   * 缓冲行数 - 减少缓冲行数以提升性能
   */
  bufferRows: { type: Number, default: 50 },
  /**
   * 最小自动列宽
   */
  minAutoColWidth: { type: Number, default: 100 },

  // /**
  //  * 是否启用行高亮 - 注释以提升性能
  //  */
  // enableRowHoverHighlight: { type: Boolean, default: false },
  // /**
  //  * 是否启用列高亮 - 注释以提升性能
  //  */
  // enableColHoverHighlight: { type: Boolean, default: false },

  /**
   * 合并单元格方法
   * @param args 参数
   * @returns 合并单元格信息
   */
  spanMethod: {
    type: Function as PropType<
      (args: {
        row: ChartDataVo.ChartData
        column: GroupStore.GroupOption | DimensionStore.DimensionOption
        rowIndex: number
        colIndex: number
      }) => { rowspan: number; colspan: number } | [number, number] | null | undefined
    >,
    default: undefined
  },

  // ========== 样式相关 Props ==========
  /**
   * 图表宽度
   */
  chartWidth: { type: [Number, String], default: '100%' },
  /**
   * 图表高度
   */
  chartHeight: { type: [Number, String], default: '100%' },
  /**
   * 高亮单元格背景色
   */
  highlightCellBackground: { type: String, default: 'rgba(24, 144, 255, 1)' },
  /**
   * 行悬停高亮颜色（包含背景色和边框色）
   */
  highlightRowBackground: { type: String, default: 'rgba(64, 158, 255, 0.1)' },
  /**
   * 列悬停高亮颜色（包含背景色和边框色）
   */
  highlightColBackground: { type: String, default: 'rgba(64, 158, 255, 0.08)' },

  /**
   * 表头高度
   */
  headerRowHeight: { type: Number, default: 32 },
  /**
   * 表头背景色
   */
  headerBackground: { type: String, default: '#f7f7f9' },
  /**
   * 表头文本颜色
   */
  headerTextColor: { type: String, default: '#303133' },
  /**
   * 表头字体
   */
  headerFontFamily: { type: String, default: defaultFontFamily },
  /**
   * 表头字体大小
   */
  headerFontSize: { type: Number, default: 13 },

  /**
   * 表格行高度
   */
  bodyRowHeight: { type: Number, default: 30 },
  /**
   * 表格行背景色（奇数行）
   */
  bodyBackgroundOdd: { type: String, default: '#ffffff' },
  /**
   * 表格行背景色（偶数行）
   */
  bodyBackgroundEven: { type: String, default: '#fafafa' },
  /**
   * 表格行文本颜色
   */
  bodyTextColor: { type: String, default: '#303133' },
  /**
   * 表格行字体
   */
  bodyFontFamily: { type: String, default: defaultFontFamily },
  /**
   * 表格行字体大小
   */
  bodyFontSize: { type: Number, default: 13 },

  /**
   * 表格边框颜色
   */
  borderColor: { type: String, default: '#dcdfe6' },

  /**
   * 汇总高度
   */
  summaryRowHeight: { type: Number, default: 30 },
  /**
   * 汇总背景色
   */
  summaryBackground: { type: String, default: '#f7f7f9' },
  /**
   * 汇总文本颜色
   */
  summaryTextColor: { type: String, default: '#303133' },
  /**
   * 汇总字体
   */
  summaryFontFamily: { type: String, default: defaultFontFamily },
  /**
   * 汇总字体大小
   */
  summaryFontSize: { type: Number, default: 14 },

  /**
   * 滚动条大小
   */
  scrollbarSize: { type: Number, default: 16 },
  /**
   * 滚动条背景色
   */
  scrollbarBackground: { type: String, default: '#f1f1f1' },
  /**
   * 滚动条滑块颜色
   */
  scrollbarThumbBackground: { type: String, default: '#c1c1c1' },
  /**
   * 滚动条滑块悬停颜色
   */
  scrollbarThumbHoverBackground: { type: String, default: '#a8a8a8' },

  /**
   * 排序箭头颜色
   */
  sortActiveColor: { type: String, default: '#409EFF' }
}
