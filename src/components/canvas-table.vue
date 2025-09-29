<template>
  <div id="table-container" class="table-container" :style="tableContainerStyle"></div>
</template>
<script lang="ts" setup>
import { chartProps } from './chart-props';
import Konva from 'konva';
import { getTableContainer, clearPool, getFromPool, getTextX, constrainToRange, returnToPool, truncateText } from './utils'
import { onMounted, onUnmounted, ref, reactive, computed, watch, nextTick } from 'vue';
import { webworker } from '@/composables/useWebworker';
const props = defineProps(chartProps);

const COLORS = {
  INACTIVE: '#d0d7de'
}
interface DrawBaseConfig {
  pools: KonvaNodePools
  name: string
}

interface DrawTextConfig extends DrawBaseConfig {
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  fill: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  cellHeight?: number
  useGetTextX?: boolean
  opacity?: number
  offsetX?: number
  offsetY?: number
}

interface DrawRectConfig extends DrawBaseConfig {
  x: number
  y: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
  listening?: boolean
}

interface TableVars {
  /**
   * 行高亮矩形
   */
  rowHighlightRects: Konva.Rect[] | null
  /**
   * 列高亮矩形
   */
  colHighlightRects: Konva.Rect[] | null

  // Body 对象池
  /**
   * 左侧主体组对象池
   */
  leftBodyPools: KonvaNodePools
  /**
   * 中间主体组对象池
   */
  centerBodyPools: KonvaNodePools
  /**
   * 右侧主体组对象池
   */
  rightBodyPools: KonvaNodePools

  /**
   * Stage 实例
   */
  stage: Konva.Stage | null
  /**
   * 滚动条层
   */
  scrollbarLayer: Konva.Layer | null

  /**
   * 表头层
   */
  headerLayer: Konva.Layer | null
  bodyLayer: Konva.Layer | null
  /**
   * 固定表body层
   */
  fixedBodyLayer: Konva.Layer | null
  summaryLayer: Konva.Layer | null

  leftHeaderGroup: Konva.Group | null
  /**
   * 中间主体组裁剪组
   */
  centerBodyClipGroup: Konva.Group | null
  /**
   * 中间表头组
   */
  centerHeaderGroup: Konva.Group | null
  rightHeaderGroup: Konva.Group | null

  /**
   * 左侧主体组
   */
  leftBodyGroup: Konva.Group | null
  centerBodyGroup: Konva.Group | null
  /**
   * 右侧主体组
   */
  rightBodyGroup: Konva.Group | null

  leftSummaryGroup: Konva.Group | null
  /**
   * 中间汇总组
   */
  centerSummaryGroup: Konva.Group | null
  rightSummaryGroup: Konva.Group | null

  verticalScrollbarGroup: Konva.Group | null
  horizontalScrollbarGroup: Konva.Group | null

  verticalScrollbarThumbRect: Konva.Rect | null
  horizontalScrollbarThumbRect: Konva.Rect | null

  highlightRect: Konva.Rect | null
  stageScrollY: number
  stageScrollX: number
  columnWidthOverrides: Record<string, number>
  // 列宽拖拽相关变量
  isResizingColumn: boolean
  // resizingColumnName: string | null
  // resizeStartX: number
  // resizeStartWidth: number
  // resizeNeighborColumnName: string | null
  // resizeNeighborStartWidth: number
  isDraggingVerticalThumb: boolean
  isDraggingHorizontalThumb: boolean
  dragStartY: number
  dragStartX: number
  dragStartScrollY: number
  dragStartScrollX: number
  visibleRowStart: number
  visibleRowEnd: number
  visibleRowCount: number
}

/**
 * 表格全局状态变量
 */
const tableVars: TableVars = {
  /**
   * 行高亮矩形
   */
  rowHighlightRects: null,
  /**
   * 列高亮矩形
   */
  colHighlightRects: null,
  /**
   * 左侧主体组对象池
   */
  leftBodyPools: {
    cellRects: [],
    cellTexts: []
  },
  /**
   * 中间主体组对象池
   */
  centerBodyPools: {
    cellRects: [],
    cellTexts: []
  },
  /**
   * 右侧主体组对象池
   */
  rightBodyPools: {
    cellRects: [],
    cellTexts: []
  },

  // ========== Konva 对象 ==========
  /**
   * Stage 实例
   */
  stage: null,

  /**
   * 滚动条层（滚动条）
   */
  scrollbarLayer: null,

  /**
   * 中间区域剪辑组（中间区域）
   */
  centerBodyClipGroup: null,

  /**
   * 表头层（固定表头）
   */
  headerLayer: null,

  /**
   * 表格层（主体）
   */
  bodyLayer: null,

  /**
   * 汇总层（汇总）
   */
  summaryLayer: null,

  /**
   * 固定表body层（固定表body）
   */
  fixedBodyLayer: null,

  /**
   * 左侧表头组（左侧表头）
   */
  leftHeaderGroup: null,

  /**
   * 中间表头组（中间表头）
   */
  centerHeaderGroup: null,

  /**
   * 右侧表头组（右侧表头）
   */
  rightHeaderGroup: null,

  /**
   * 左侧主体组（左侧主体）
   */
  leftBodyGroup: null,

  /**
   * 中间主体组（中间主体）
   */
  centerBodyGroup: null,

  /**
   * 右侧主体组
   */
  rightBodyGroup: null,

  /**
   * 左侧汇总组（左侧汇总）
   */
  leftSummaryGroup: null,

  /**
   * 中间汇总组（中间汇总）
   */
  centerSummaryGroup: null,

  /**
   * 右侧汇总组（右侧汇总）
   */
  rightSummaryGroup: null,

  /**
   * 垂直滚动条组
   */
  verticalScrollbarGroup: null,

  /**
   * 水平滚动条组
   */
  horizontalScrollbarGroup: null,

  /**
   * 垂直滚动条滑块
   */
  verticalScrollbarThumbRect: null,

  /**
   * 水平滚动条滑块
   */
  horizontalScrollbarThumbRect: null,

  /**
   * 高亮矩形
   */
  highlightRect: null,

  // ========== 滚动相关 ==========
  /**
   * 垂直滚动多少像素
   */
  stageScrollY: 0,

  /**
   * 水平滚动多少像素
   */
  stageScrollX: 0,

  // ========== 列宽拖拽相关状态 ==========
  /**
   * 列宽拖拽相关状态
   */
  columnWidthOverrides: {},

  /**
   * 列宽拖拽状态
   */
  isResizingColumn: false,

  /**
   * 列宽拖拽列名 - 已注释掉
   */
  // resizingColumnName: null,

  /**
   * 列宽拖拽起始 X 坐标 - 已注释掉
   */
  // resizeStartX: 0,

  /**
   * 列宽拖拽起始宽度 - 已注释掉
   */
  // resizeStartWidth: 0,

  /**
   * 列宽拖拽邻居列名 - 已注释掉
   */
  // resizeNeighborColumnName: null,

  /**
   * 列宽拖拽邻居起始宽度 - 已注释掉
   */
  // resizeNeighborStartWidth: 0,

  // ========== 滚动条拖拽相关 ==========
  /**
   * 是否正在垂直拖动滚动条
   */
  isDraggingVerticalThumb: false,

  /**
   * 是否正在水平拖动滚动条
   */
  isDraggingHorizontalThumb: false,

  /**
   * 垂直滚动条拖拽起始 Y 坐标
   */
  dragStartY: 0,

  /**
   * 水平滚动条拖拽起始 X 坐标
   */
  dragStartX: 0,

  /**
   * 垂直滚动条拖拽起始滚动位置 Y
   */
  dragStartScrollY: 0,

  /**
   * 水平滚动条拖拽起始滚动位置 X
   */
  dragStartScrollX: 0,

  // ========== 虚拟滚动相关 ==========
  /**
   * 可视区域起始行索引
   */
  visibleRowStart: 0,

  /**
   * 可视区域结束行索引
   */
  visibleRowEnd: 0,

  /**
   * 上下缓冲行数
   */
  visibleRowCount: 0,

}

interface SortColumn {
  columnName: string
  order: 'asc' | 'desc'
}
// 常量定义
const LAYOUT_CONSTANTS = {
  ICON_AREA_WIDTH: 40, // 右侧图标区域预留宽度
  SORT_ARROW_OFFSET: 34, // 排序箭头距离右边缘的距离
  FILTER_ICON_OFFSET: 12, // 过滤图标距离右边缘的距离
  RESIZER_WIDTH: 6, // 列宽调整手柄宽度
  ARROW_SIZE: 8, // 排序箭头大小 (从5增加到8)
  ARROW_GAP: 2, // 上下箭头间距 (从2增加到3)
  FILTER_ICON_SIZE: 16 // 过滤图标大小
} as const

/**
 * 绘制文本
 * @param {DrawTextConfig} config - 绘制文本配置
 * @returns {Konva.Text} 文本节点
 */
const drawUnifiedText = (config: DrawTextConfig) => {
  const {
    pools,
    name,
    text,
    x,
    y,
    fontSize,
    fontFamily,
    fill,
    align = 'left',
    verticalAlign = 'middle',
    cellHeight,
    useGetTextX = false,
    opacity = 1,
    offsetX = 0,
    offsetY = 0
  } = config

  const textNode = getFromPool(pools.cellTexts, () => new Konva.Text({ listening: false, name }))

  textNode.name(name)
  textNode.setAttr('row-index', null)
  textNode.setAttr('col-index', null)

  if (useGetTextX) {
    textNode.x(getTextX(x))
    textNode.y(cellHeight ? y + cellHeight / 2 : y)
  } else {
    textNode.x(x)
    textNode.y(y)
  }

  textNode.text(text)
  textNode.fontSize(fontSize)
  textNode.fontFamily(fontFamily)
  textNode.fill(fill)
  textNode.opacity(opacity)
  textNode.align(align)
  textNode.verticalAlign(verticalAlign)

  if (align === 'center' && verticalAlign === 'middle') {
    const w = textNode.width()
    const h = textNode.height()
    textNode.offset({ x: w / 2, y: h / 2 })
  } else if (useGetTextX && verticalAlign === 'middle') {
    textNode.offsetY(textNode.height() / 2)
  }

  if (offsetX || offsetY) {
    const prev = textNode.offset()
    textNode.offset({ x: (prev.x || 0) + (offsetX || 0), y: (prev.y || 0) + (offsetY || 0) })
  }

  return textNode
}

/**
 * 绘制矩形
 * @param {DrawRectConfig} config - 绘制矩形配置
 * @returns {Konva.Rect} 矩形节点
 */
const drawUnifiedRect = (config: DrawRectConfig): Konva.Rect => {
  const { pools, name, x, y, width, height, fill, stroke, strokeWidth = 1, cornerRadius = 0, listening = true } = config

  const rect: Konva.Rect = getFromPool<Konva.Rect>(pools.cellRects, () => new Konva.Rect({ listening, name }))
  rect.name(name)
  rect.off('click')
  rect.off('mouseenter')
  rect.off('mouseleave')
  rect.x(x)
  rect.y(y)
  rect.width(width)
  rect.height(height)
  if (fill !== undefined) rect.fill(fill)
  if (stroke !== undefined) rect.stroke(stroke)
  rect.strokeWidth(strokeWidth)
  if (cornerRadius) rect.cornerRadius(cornerRadius)
  return rect
}

/**
 * 排序状态 - 单独的响应式变量
 */
const sortColumns = ref<SortColumn[]>([])

/**
 * 过滤状态：列名 -> 选中的离散值集合 - 单独的响应式变量
 */
const filterState = reactive<Record<string, Set<string>>>({})

/**
 * 汇总行选择状态：列名 -> 选中的规则 - 单独的响应式变量
 */
const summaryState = reactive<Record<string, string>>({})

/**
 * 表格数据
 */
const tableData = ref<Array<ChartDataVo.ChartData>>([])

/**
 * 表格列
 */
const tableColumns = ref<Array<GroupStore.GroupOption | DimensionStore.DimensionOption>>([])


/**
 * 表格容器样式
 */
const tableContainerStyle = computed(() => {
  const height = typeof props.chartHeight === 'number' ? `${props.chartHeight}px` : (props.chartHeight ?? '460px')
  const width = typeof props.chartWidth === 'number' ? `${props.chartWidth}px` : (props.chartWidth ?? '100%')
  return {
    height,
    width,
    background: '#fff'
  }
})
/**
 * 处理表格列
 * @param {Array<GroupStore.GroupOption>} xAxisFields - x轴字段
 * @param {Array<DimensionStore.DimensionOption>} yAxisFields - y轴字段
 * @returns {void}
 */
const handleTableColumns = (
  xAxisFields: Array<GroupStore.GroupOption>,
  yAxisFields: Array<DimensionStore.DimensionOption>
) => {
  const leftColsx = xAxisFields.filter((c) => c.fixed === 'left')
  const rightColsx = xAxisFields.filter((c) => c.fixed === 'right')
  const centerColsx = xAxisFields.filter((c) => !c.fixed)
  const leftColsy = yAxisFields.filter((c) => c.fixed === 'left')
  const rightColsy = yAxisFields.filter((c) => c.fixed === 'right')
  const centerColsy = yAxisFields.filter((c) => !c.fixed)
  tableColumns.value = leftColsx
    .concat(centerColsx)
    .concat(rightColsx)
    .concat(leftColsy)
    .concat(centerColsy)
    .concat(rightColsy)
}
/**
 * 原始数据存储 - 不被排序或过滤修改
 */
const originalData = ref<Array<ChartDataVo.ChartData>>([])

/**
 * 处理表格数据
 * @param {Array<ChartDataVo.ChartData>} data - 表格数据
 * @returns {void}
 */
const handleTableData = (data: Array<ChartDataVo.ChartData>) => {
  // 保存原始数据
  originalData.value = data.filter((row) => row && typeof row === 'object')

  // 开始处理数据
  let processedData = [...originalData.value]

  // 应用过滤
  const filterKeys = Object.keys(filterState).filter((k) => filterState[k] && filterState[k].size > 0)
  if (filterKeys.length) {
    processedData = processedData.filter((row) => {
      for (const k of filterKeys) {
        const set = filterState[k]
        const val = row[k]
        if (!set.has(String(val ?? ''))) return false
      }
      return true
    })
  }

  // 应用排序
  if (sortColumns.value.length) {
    const toNum = (v: string | number | null | undefined) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const getVal = (row: ChartDataVo.ChartData, key: string): string | number | undefined => {
      const val = row[key]
      if (typeof val === 'string' || typeof val === 'number') return val
      return undefined
    }
    processedData.sort((a, b) => {
      for (const s of sortColumns.value) {
        const key = s.columnName
        const av = getVal(a, key)
        const bv = getVal(b, key)
        const an = toNum(av)
        const bn = toNum(bv)
        let cmp = 0
        if (an !== null && bn !== null) cmp = an - bn
        else cmp = String(av ?? '').localeCompare(String(bv ?? ''))
        if (cmp !== 0) return s.order === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }

  // 更新最终数据
  tableData.value = processedData
}
/**
 * 重置表格变量
 * @returns {void}
 */
const resetTableVars = () => {
  // 重置 Konva 对象
  tableVars.stage = null
  tableVars.scrollbarLayer = null
  tableVars.headerLayer = null
  tableVars.bodyLayer = null
  tableVars.summaryLayer = null
  tableVars.fixedBodyLayer = null
  tableVars.leftHeaderGroup = null
  tableVars.centerHeaderGroup = null
  tableVars.rightHeaderGroup = null
  tableVars.leftBodyGroup = null
  tableVars.centerBodyGroup = null
  tableVars.rightBodyGroup = null
  tableVars.leftSummaryGroup = null
  tableVars.centerSummaryGroup = null
  tableVars.rightSummaryGroup = null
  tableVars.verticalScrollbarGroup = null
  tableVars.horizontalScrollbarGroup = null
  tableVars.verticalScrollbarThumbRect = null
  tableVars.horizontalScrollbarThumbRect = null
  tableVars.highlightRect = null

  // 重置滚动相关
  tableVars.stageScrollY = 0
  tableVars.stageScrollX = 0

  // 重置列宽拖拽相关 - 已注释掉
  tableVars.columnWidthOverrides = {}

  tableVars.isResizingColumn = false
  // tableVars.resizingColumnName = null
  // tableVars.resizeStartX = 0
  // tableVars.resizeStartWidth = 0
  // tableVars.resizeNeighborColumnName = null
  // tableVars.resizeNeighborStartWidth = 0

  // 重置滚动条拖拽相关
  tableVars.isDraggingVerticalThumb = false
  tableVars.isDraggingHorizontalThumb = false
  tableVars.dragStartY = 0
  tableVars.dragStartX = 0
  tableVars.dragStartScrollY = 0
  tableVars.dragStartScrollX = 0

  // 重置虚拟滚动相关
  tableVars.visibleRowStart = 0
  tableVars.visibleRowEnd = 0
  tableVars.visibleRowCount = 0


  // 重置排序相关
  sortColumns.value.length = 0

  // 重置过滤和汇总相关
  Object.keys(filterState).forEach((key) => delete filterState[key])
  Object.keys(summaryState).forEach((key) => delete summaryState[key])
}

/**
 * 处理表头排序点击
 * @param {string} columnName - 列名
 * @returns {void}
 */
const handleHeaderSort = (columnName: string) => {
  const existingIndex = sortColumns.value.findIndex((s) => s.columnName === columnName)

  if (existingIndex >= 0) {
    // 如果已经存在，切换排序方向
    const current = sortColumns.value[existingIndex]
    if (current.order === 'asc') {
      current.order = 'desc'
    } else {
      // 移除排序
      sortColumns.value.splice(existingIndex, 1)
    }
  } else {
    // 新增排序（默认降序）
    sortColumns.value.push({
      columnName,
      order: 'desc'
    })
  }

  // 重新处理数据 - 使用原始数据重新排序
  handleTableData(originalData.value)
}

/**
 * 获取列的排序状态
 * @param {string} columnName - 列名
 * @returns {'asc' | 'desc' | null} 排序状态
 */
const getColumnSortOrder = (columnName: string): 'asc' | 'desc' | null => {
  const sortColumn = sortColumns.value.find((s) => s.columnName === columnName)
  return sortColumn ? sortColumn.order : null
}

const summaryRowHeight = computed(() => (props.enableSummary ? props.summaryRowHeight : 0))



/**
 * 对象池 属性
 */
interface KonvaNodePools {
  /**
   * 单元格矩形
   */
  cellRects: Konva.Rect[]
  /**
   * 单元格文本
   */
  cellTexts: Konva.Text[]
}

/**
 * 数字列 汇总方式
 */
const numberOptions = [
  { label: '不展示', value: 'nodisplay' },
  { label: '最大', value: 'max' },
  { label: '最小', value: 'min' },
  { label: '平均', value: 'avg' },
  { label: '求和', value: 'sum' }
]

/**
 * 文本列 汇总方式
 */
const textOptions = [
  { label: '不展示', value: 'nodisplay' },
  { label: '已填写', value: 'filled' },
  { label: '未填写', value: 'nofilled' }
]
/**
   * 初始化 Stage 和所有 Layer
   * @returns {void}
   */
const initStage = () => {
  const tableContainer = getTableContainer()
  if (!tableContainer) return
  const width = tableContainer.clientWidth
  const height = tableContainer.clientHeight

  if (!tableVars.stage) {
    tableVars.stage = new Konva.Stage({ container: tableContainer, width, height })
  } else {
    tableVars.stage.size({ width, height })
  }

  // 1. 主体内容层（最底层 - 可滚动的body部分）
  if (!tableVars.bodyLayer) {
    tableVars.bodyLayer = new Konva.Layer()
    tableVars.stage.add(tableVars.bodyLayer)
  }

  // 2. 固定列body层（中间层 - 左右固定列的body部分）
  if (!tableVars.fixedBodyLayer) {
    tableVars.fixedBodyLayer = new Konva.Layer()
    tableVars.stage.add(tableVars.fixedBodyLayer)
  }

  // 3. 表头层（高层 - 所有表头，不被遮挡）
  if (!tableVars.headerLayer) {
    tableVars.headerLayer = new Konva.Layer()
    tableVars.stage.add(tableVars.headerLayer)
  }

  // 4. 滚动条层（最高层）
  if (!tableVars.scrollbarLayer) {
    tableVars.scrollbarLayer = new Konva.Layer()
    tableVars.stage.add(tableVars.scrollbarLayer)
  }

  // 5. 汇总层（像header一样，统一管理）
  if (!tableVars.summaryLayer) {
    tableVars.summaryLayer = new Konva.Layer()
    tableVars.stage.add(tableVars.summaryLayer)
  }

  tableVars.stage.setPointersPositions({
    clientX: 0,
    clientY: 0
  })
}

/**
 * 清理所有 Stage 相关资源
 * @returns {void}
 */
const destroyStage = () => {
  tableVars.stage?.destroy()
  tableVars.stage = null
  // 修复后有4个真实的Layer
  tableVars.headerLayer = null
  tableVars.bodyLayer = null
  tableVars.fixedBodyLayer = null
  tableVars.scrollbarLayer = null
  // 这些只是引用，设为null即可
  tableVars.summaryLayer = null
  tableVars.highlightRect = null
}

/**
 * 设置指针样式的辅助函数
 * @param {boolean} on - 是否显示指针
 * @param {string} cursor - 指针样式
 */
const setPointerStyle = (on: boolean, cursor: string) => {
  if (tableVars.stage) tableVars.stage.container().style.cursor = on ? cursor : 'default'
}

/**
 * 获取 Stage 的属性
 * @returns {Object} Stage 属性对象
 */
const getStageAttr = () => {
  if (!tableVars.stage) return { width: 0, height: 0 }
  return {
    width: tableVars.stage.width(),
    height: tableVars.stage.height()
  }
}

/**
   * 计算左右固定列与中间列的分组与宽度汇总
   * @returns {Object} 分组与宽度汇总
   */
const getSplitColumns = () => {
  if (!tableVars.stage) {
    const leftCols = tableColumns.value.filter((c) => c.fixed === 'left')
    const rightCols = tableColumns.value.filter((c) => c.fixed === 'right')
    const centerCols = tableColumns.value.filter((c) => !c.fixed)
    return {
      leftCols,
      centerCols,
      rightCols,
      leftWidth: 0,
      centerWidth: 0,
      rightWidth: 0,
      totalWidth: 0
    }
  }
  // 计算滚动条预留宽度 高度
  const { width: stageWidthRaw, height: stageHeightRaw } = getStageAttr()
  // 计算内容高度
  const contentHeight = tableData.value.length * props.bodyRowHeight
  // 计算垂直滚动条预留空间
  const verticalScrollbarSpace =
    contentHeight > stageHeightRaw - props.headerRowHeight - summaryRowHeight.value ? props.scrollbarSize : 0
  // 计算内容宽度
  const stageWidth = stageWidthRaw - verticalScrollbarSpace

  // 计算已设置宽度的列的总宽度
  const fixedWidthColumns = tableColumns.value.filter((c) => c.width !== undefined)
  const autoWidthColumns = tableColumns.value.filter((c) => c.width === undefined)
  const fixedTotalWidth = fixedWidthColumns.reduce((acc, c) => acc + (c.width || 0), 0)

  // 计算自动宽度列应该分配的宽度
  const remainingWidth = Math.max(0, stageWidth - fixedTotalWidth)
  const rawAutoWidth = autoWidthColumns.length > 0 ? remainingWidth / autoWidthColumns.length : 0
  const autoColumnWidth = Math.max(props.minAutoColWidth, rawAutoWidth)

  // 为每个列计算最终宽度（支持用户拖拽覆盖）
  const columnsWithWidth = tableColumns.value.map((columnOption) => {
    const overrideWidth = tableVars.columnWidthOverrides[columnOption.columnName as string]
    const width =
      overrideWidth !== undefined
        ? overrideWidth
        : columnOption.width !== undefined
          ? columnOption.width
          : autoColumnWidth

    return { ...columnOption, width }
  })
  const leftCols = columnsWithWidth.filter((c) => c.fixed === 'left')
  const centerCols = columnsWithWidth.filter((c) => !c.fixed)
  const rightCols = columnsWithWidth.filter((c) => c.fixed === 'right')

  /**
   * 计算列宽总和
   * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} columns - 列数组
   * @returns {number} 列宽总和
   */
  const sumWidth = (columns: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>) =>
    columns.reduce((acc, column) => acc + (column.width || 0), 0)

  return {
    leftCols,
    centerCols,
    rightCols,
    leftWidth: sumWidth(leftCols),
    centerWidth: sumWidth(centerCols),
    rightWidth: sumWidth(rightCols),
    totalWidth: sumWidth(columnsWithWidth)
  }
}

/**
 * 获取滚动限制
 * @returns {Object} 滚动限制
 */
const getScrollLimits = () => {
  if (!tableVars.stage) return { maxScrollX: 0, maxScrollY: 0 }
  const { totalWidth, leftWidth, rightWidth } = getSplitColumns()

  const { width: stageWidth, height: stageHeight } = getStageAttr()

  // 计算内容高度
  const contentHeight = tableData.value.length * props.bodyRowHeight

  // 初步估算：不预留滚动条空间
  const visibleContentWidthNoV = stageWidth - leftWidth - rightWidth
  const contentHeightNoH = stageHeight - props.headerRowHeight - summaryRowHeight.value
  const prelimMaxX = Math.max(0, totalWidth - leftWidth - rightWidth - visibleContentWidthNoV)
  const prelimMaxY = Math.max(0, contentHeight - contentHeightNoH)
  const verticalScrollbarSpace = prelimMaxY > 0 ? props.scrollbarSize : 0
  const horizontalScrollbarSpace = prelimMaxX > 0 ? props.scrollbarSize : 0
  // 复算：考虑另一条滚动条占位
  const visibleContentWidth = stageWidth - leftWidth - rightWidth - verticalScrollbarSpace
  const maxScrollX = Math.max(0, totalWidth - leftWidth - rightWidth - visibleContentWidth)
  const maxScrollY = Math.max(
    0,
    contentHeight - (stageHeight - props.headerRowHeight - summaryRowHeight.value - horizontalScrollbarSpace)
  )

  return { maxScrollX, maxScrollY }
}
/**
 * 计算可视区域数据的起始行和结束行
 * @returns {void}
 */
const calculateVisibleRows = () => {
  if (!tableVars.stage) return
  const stageHeight = tableVars.stage.height()
  const bodyHeight = stageHeight - props.headerRowHeight - summaryRowHeight.value - props.scrollbarSize

  // 计算可视区域能显示的行数
  tableVars.visibleRowCount = Math.ceil(bodyHeight / props.bodyRowHeight)

  // 根据scrollY计算起始行
  const startRow = Math.floor(tableVars.stageScrollY / props.bodyRowHeight)

  // 算上缓冲条数的开始下标+结束下标
  tableVars.visibleRowStart = Math.max(0, startRow - props.bufferRows)
  tableVars.visibleRowEnd = Math.min(
    tableData.value.length - 1,
    startRow + tableVars.visibleRowCount + props.bufferRows
  )
}

/**
 * 刷新表格（可选重置滚动位置）
 * @param {boolean} resetScroll - 是否重置滚动位置
 */
const refreshTable = (resetScroll: boolean) => {

  if (resetScroll) {
    tableVars.stageScrollX = 0
    tableVars.stageScrollY = 0
  } else {
    const { maxScrollX, maxScrollY } = getScrollLimits()
    tableVars.stageScrollX = constrainToRange(tableVars.stageScrollX, 0, maxScrollX)
    tableVars.stageScrollY = constrainToRange(tableVars.stageScrollY, 0, maxScrollY)
  }

  calculateVisibleRows()
  clearGroups()
  rebuildGroups()
}


/**
 * 修复的Layer批量绘制 - 5个真实的Layer，确保表头和汇总固定
 * @param {Array<'header' | 'body' | 'fixed' | 'scrollbar' | 'summary'>} layers - 要绘制的层
 */
const scheduleLayersBatchDraw = (layers: Array<'header' | 'body' | 'fixed' | 'scrollbar' | 'summary'> = ['body']) => {
  // 简化版本：直接执行绘制，不使用批量优化
  layers.forEach((layerType) => {
    switch (layerType) {
      case 'header':
        tableVars.headerLayer?.batchDraw() // 表头层（固定不滚动）
        break
      case 'body':
        tableVars.bodyLayer?.batchDraw() // 主体内容层（可滚动）
        break
      case 'fixed':
        tableVars.fixedBodyLayer?.batchDraw() // 固定列层（左右固定）
        break
      case 'scrollbar':
        tableVars.scrollbarLayer?.batchDraw() // 滚动条层
        break
      case 'summary':
        tableVars.summaryLayer?.batchDraw() // 汇总行层（底部固定）
        break
    }
  })
}
/**
 * 更新横纵滚动条位置
 * @returns {void}
 */
const updateScrollbarPosition = () => {
  if (!tableVars.stage) return

  const { width: stageWidth, height: stageHeight } = getStageAttr()
  const { maxScrollX, maxScrollY } = getScrollLimits()

  // 更新垂直滚动条位置
  if (tableVars.verticalScrollbarThumbRect && maxScrollY > 0) {
    const trackHeight =
      stageHeight - props.headerRowHeight - summaryRowHeight.value - (maxScrollX > 0 ? props.scrollbarSize : 0)
    const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * props.bodyRowHeight))
    const thumbY = props.headerRowHeight + (tableVars.stageScrollY / maxScrollY) * (trackHeight - thumbHeight)
    tableVars.verticalScrollbarThumbRect.y(thumbY)
  }

  // 更新水平滚动条位置
  if (tableVars.horizontalScrollbarThumbRect && maxScrollX > 0) {
    const { leftWidth, rightWidth, centerWidth } = getSplitColumns()
    const visibleWidth = stageWidth - leftWidth - rightWidth - (maxScrollY > 0 ? props.scrollbarSize : 0)
    const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / centerWidth)
    const thumbX = leftWidth + (tableVars.stageScrollX / maxScrollX) * (visibleWidth - thumbWidth)
    tableVars.horizontalScrollbarThumbRect.x(thumbX)
  }

  tableVars.scrollbarLayer?.batchDraw()
}

/**
 * 更新滚动位置
 * @returns {void}
 */
const updateScrollPositions = () => {
  if (
    !tableVars.leftBodyGroup ||
    !tableVars.centerBodyGroup ||
    !tableVars.rightBodyGroup ||
    !tableVars.centerHeaderGroup
  )
    return
  const centerX = -tableVars.stageScrollX
  const headerX = -tableVars.stageScrollX

  /**
   * 更新左侧和右侧主体（只有 Y 位置变化）
   * 注意：由于左右body组现在在裁剪组中，Y位置应该相对于裁剪组
   * @returns {void}
   */
  tableVars.leftBodyGroup.y(-tableVars.stageScrollY)
  tableVars.rightBodyGroup.y(-tableVars.stageScrollY)

  /**
   * 更新中间主体（X 和 Y 位置变化）
   * @returns {void}
   */
  tableVars.centerBodyGroup.x(centerX)
  tableVars.centerBodyGroup.y(-tableVars.stageScrollY)

  /**
   * 更新中心表头（只有 X 位置变化）
   * @returns {void}
   */
  tableVars.centerHeaderGroup.x(headerX)

  /**
   * 更新汇总组位置（完全参考表头的实现方式）
   * 左右汇总组：固定位置，不滚动
   * 中间汇总组：在裁剪组中，只需要更新x位置跟随滚动
   * @returns {void}
   */
  if (tableVars.leftSummaryGroup) {
    // 左侧汇总组：固定位置，不需要更新（与左侧表头一样）
    // 位置已在创建时设置，保持不变
  }
  if (tableVars.rightSummaryGroup) {
    // 右侧汇总组：固定位置，不需要更新（与右侧表头一样）
    // 位置已在创建时设置，保持不变
  }
  if (tableVars.centerSummaryGroup) {
    // 中间汇总组：在裁剪组中，需要跟随水平滚动（与中间表头一致）
    tableVars.centerSummaryGroup.x(headerX)
    tableVars.centerSummaryGroup.y(0) // 相对于裁剪组
  }

  updateScrollbarPosition()

  // 水平滚动时也需要重绘固定层
  scheduleLayersBatchDraw(['body', 'fixed', 'scrollbar', 'summary'])
  // updateFilterDropdownPositionsInTable()
  // updateSummaryDropdownPositionsInTable()
}
/**
 * 优化的节点回收 - 批量处理减少遍历次数
 * @param {Konva.Group} bodyGroup - 分组
 * @param {KonvaNodePools} pools - 对象池
 * @returns {void}
 */
const recoverKonvaNode = (bodyGroup: Konva.Group, pools: KonvaNodePools) => {
  // 清空当前组，将对象返回池中
  const children = bodyGroup.children.slice()
  const textsToRecover: Konva.Text[] = []
  const rectsToRecover: Konva.Rect[] = []

  // 分类收集需要回收的节点
  children.forEach((child) => {
    if (child instanceof Konva.Text) {
      const name = child.name()
      // 处理合并单元格和普通单元格文本节点回收
      if (name === 'merged-cell-text' || name === 'cell-text') {
        textsToRecover.push(child)
      }
    } else if (child instanceof Konva.Rect) {
      const name = child.name()
      // 处理合并单元格和普通单元格矩形节点回收
      if (name === 'merged-cell-rect' || name === 'cell-rect') {
        rectsToRecover.push(child)
      }
    }
  })

  // 批量回收
  textsToRecover.forEach((text) => returnToPool(pools.cellTexts, text))
  rectsToRecover.forEach((rect) => returnToPool(pools.cellRects, rect))

  // 清空高亮缓存
  // invalidateHighlightCache()
}


/**
 * 计算单元格合并信息
 * @param {NonNullable<typeof props.spanMethod>} spanMethod - 合并方法
 * @param {ChartDataVo.ChartData} row - 行数据
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {number} rowIndex - 行索引
 * @param {number} globalColIndex - 全局列索引
 * @returns {Object} 合并信息
 */
const calculateCellSpan = (
  spanMethod: NonNullable<typeof props.spanMethod>,
  row: ChartDataVo.ChartData,
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  rowIndex: number,
  globalColIndex: number
) => {
  const res = spanMethod({ row, column: columnOption, rowIndex, colIndex: globalColIndex })
  let spanRow = 1
  let spanCol = 1

  if (Array.isArray(res)) {
    spanRow = Math.max(0, Number(res[0]) || 0)
    spanCol = Math.max(0, Number(res[1]) || 0)
  } else if (res && typeof res === 'object') {
    spanRow = Math.max(0, Number(res.rowspan) || 0)
    spanCol = Math.max(0, Number(res.colspan) || 0)
  }

  // 只要任一维度为 0，即视为被合并覆盖（与常见表格合并语义一致）
  const coveredBySpanMethod = spanRow === 0 || spanCol === 0

  return { spanRow, spanCol, coveredBySpanMethod }
}

/**
 * 计算合并单元格的总宽度
 * @param {number} spanCol - 跨列数
 * @param {number} colIndex - 列索引
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} bodyCols - 列配置数组
 * @param {number} columnWidth - 列宽度
 * @returns {number} 合并单元格总宽度
 */
const calculateMergedCellWidth = (
  spanCol: number,
  colIndex: number,
  bodyCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>,
  columnWidth: number
) => {
  if (spanCol <= 1) return columnWidth

  let totalWidth = 0
  for (let i = 0; i < spanCol && colIndex + i < bodyCols.length; i++) {
    const colInfo = bodyCols[colIndex + i]
    totalWidth += colInfo.width || 0
  }
  return totalWidth
}


/**
 * 获取单元格显示值
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {ChartDataVo.ChartData} row - 行数据
 * @param {number} rowIndex - 行索引
 * @returns {string} 显示值
 */
const getCellDisplayValue = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  row: ChartDataVo.ChartData,
  rowIndex: number
) => {
  const rawValue =
    columnOption.columnName === '__index__'
      ? String(rowIndex + 1)
      : row && typeof row === 'object'
        ? row[columnOption.columnName]
        : undefined
  return String(rawValue ?? '')
}


/**
 * 创建合并单元格
 * @param {KonvaNodePools} pools - 对象池
 * @param {Konva.Group} bodyGroup - 主体组
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {number} cellWidth - 单元格宽度
 * @param {number} cellHeight - 单元格高度
 * @param {number} rowIndex - 行索引
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {ChartDataVo.ChartData} row - 行数据
 * @param {number} bodyFontSize - 字体大小
 */
const drawMergedCell = (
  pools: KonvaNodePools,
  bodyGroup: Konva.Group,
  x: number,
  y: number,
  cellWidth: number,
  cellHeight: number,
  rowIndex: number,
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  row: ChartDataVo.ChartData,
  bodyFontSize: number
) => {
  // 绘制合并单元格背景
  const mergedCellRect = drawUnifiedRect({
    pools,
    name: 'merged-cell-rect',
    x,
    y,
    width: cellWidth,
    height: cellHeight,
    fill: rowIndex % 2 === 0 ? props.bodyBackgroundOdd : props.bodyBackgroundEven,
    stroke: props.borderColor,
    strokeWidth: 1
  })
  bodyGroup.add(mergedCellRect)

  // 绘制合并单元格文本
  const value = getCellDisplayValue(columnOption, row, rowIndex)
  const maxTextWidth = cellWidth - 16
  const truncatedValue = truncateText(value, maxTextWidth, bodyFontSize, props.bodyFontFamily)

  const mergedCellText = drawUnifiedText({
    pools,
    name: 'merged-cell-text',
    text: truncatedValue,
    x,
    y,
    fontSize: bodyFontSize,
    fontFamily: props.bodyFontFamily,
    fill: props.bodyTextColor,
    align: columnOption.align || 'left',
    verticalAlign: 'middle',
    cellHeight,
    useGetTextX: true
  })
  bodyGroup.add(mergedCellText)
}


/**
 * 创建普通单元格
 * @param {KonvaNodePools} pools - 对象池
 * @param {Konva.Group} bodyGroup - 主体组
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {number} cellWidth - 单元格宽度
 * @param {number} cellHeight - 单元格高度
 * @param {number} rowIndex - 行索引
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {ChartDataVo.ChartData} row - 行数据
 * @param {number} bodyFontSize - 字体大小
 */
const drawNormalCell = (
  pools: KonvaNodePools,
  bodyGroup: Konva.Group,
  x: number,
  y: number,
  cellWidth: number,
  cellHeight: number,
  rowIndex: number,
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  row: ChartDataVo.ChartData,
  bodyFontSize: number
) => {
  // 绘制单元格背景
  const cellRect = drawUnifiedRect({
    pools,
    name: 'cell-rect',
    x,
    y,
    width: cellWidth,
    height: cellHeight,
    fill: rowIndex % 2 === 0 ? props.bodyBackgroundOdd : props.bodyBackgroundEven,
    stroke: props.borderColor,
    strokeWidth: 1
  })

  // cellRect.off('click.cell')
  // cellRect.on('click.cell', handleClick)
  bodyGroup.add(cellRect)

  // 绘制单元格文本
  const value = getCellDisplayValue(columnOption, row, rowIndex)
  const maxTextWidth = cellWidth - 16
  const truncatedValue = truncateText(value, maxTextWidth, bodyFontSize, props.bodyFontFamily)

  const cellText = drawUnifiedText({
    pools,
    name: 'cell-text',
    text: truncatedValue,
    x,
    y,
    fontSize: bodyFontSize,
    fontFamily: props.bodyFontFamily,
    fill: props.bodyTextColor,
    align: columnOption.align || 'left',
    verticalAlign: 'middle',
    cellHeight,
    useGetTextX: true
  })
  bodyGroup.add(cellText)
}


/**
 * 渲染单个单元格
 * @param {Object} params - 渲染参数
 * @param {KonvaNodePools} params.pools - 对象池
 * @param {Konva.Group} params.bodyGroup - 主体组
 * @param {number} params.x - x坐标
 * @param {number} params.y - y坐标
 * @param {number} params.rowIndex - 行索引
 * @param {number} params.colIndex - 列索引
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} params.columnOption - 列配置
 * @param {ChartDataVo.ChartData} params.row - 行数据
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} params.bodyCols - 列配置数组
 * @param {NonNullable<typeof props.spanMethod> | null} params.spanMethod - 合并方法
 * @param {boolean} params.hasSpanMethod - 是否有合并方法
 * @param {Map<string, number>} params.globalIndexByColName - 全局列索引映射
 * @param {number} params.bodyFontSize - 字体大小
 * @returns {Object} 渲染结果
 */
const renderCell = (params: {
  pools: KonvaNodePools
  bodyGroup: Konva.Group
  x: number
  y: number
  rowIndex: number
  colIndex: number
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption
  row: ChartDataVo.ChartData
  bodyCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>
  spanMethod: NonNullable<typeof props.spanMethod> | null
  hasSpanMethod: boolean
  globalIndexByColName: Map<string, number>
  bodyFontSize: number
}) => {
  const {
    pools,
    bodyGroup,
    x,
    y,
    rowIndex,
    colIndex,
    columnOption,
    row,
    bodyCols,
    spanMethod,
    hasSpanMethod,
    globalIndexByColName,
    bodyFontSize
  } = params

  const columnWidth = columnOption.width || 0
  if (columnWidth <= 0) return { newX: x + columnWidth, skipCols: 0 }

  // 计算合并单元格信息
  let spanRow = 1
  let spanCol = 1
  let coveredBySpanMethod = false

  if (hasSpanMethod && spanMethod) {
    const globalColIndex = globalIndexByColName.get(columnOption.columnName as string) ?? colIndex
    const spanInfo = calculateCellSpan(spanMethod, row, columnOption, rowIndex, globalColIndex)
    spanRow = spanInfo.spanRow
    spanCol = spanInfo.spanCol
    coveredBySpanMethod = spanInfo.coveredBySpanMethod
  }

  // 如果被合并覆盖，跳过绘制
  if (hasSpanMethod && coveredBySpanMethod) {
    return { newX: x + columnWidth, skipCols: 0 }
  }

  const computedRowSpan = hasSpanMethod ? spanRow : 1
  const cellHeight = computedRowSpan * props.bodyRowHeight
  const cellWidth = calculateMergedCellWidth(spanCol, colIndex, bodyCols, columnWidth)
  // 绘制单元格
  if (hasSpanMethod && (computedRowSpan > 1 || spanCol > 1)) {
    drawMergedCell(pools, bodyGroup, x, y, cellWidth, cellHeight, rowIndex, columnOption, row, bodyFontSize)
  } else {
    drawNormalCell(pools, bodyGroup, x, y, cellWidth, cellHeight, rowIndex, columnOption, row, bodyFontSize)
  }

  // 计算下一个位置和跳过的列数
  const skipCols = hasSpanMethod && spanCol > 1 ? spanCol - 1 : 0
  const newX = hasSpanMethod && spanCol > 1 ? x + cellWidth : x + columnWidth

  return { newX, skipCols }
}
/**
 * 渲染单行的所有单元格
 * @param {Object} params - 渲染参数
 * @param {number} params.rowIndex - 行索引
 * @param {number} params.y - y坐标
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} params.bodyCols - 列配置数组
 * @param {KonvaNodePools} params.pools - 对象池
 * @param {Konva.Group} params.bodyGroup - 主体组
 * @param {NonNullable<typeof props.spanMethod> | null} params.spanMethod - 合并方法
 * @param {boolean} params.hasSpanMethod - 是否有合并方法
 * @param {Map<string, number>} params.globalIndexByColName - 全局列索引映射
 * @param {number} params.bodyFontSize - 字体大小
 */
const renderRowCells = (params: {
  rowIndex: number
  y: number
  bodyCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>
  pools: KonvaNodePools
  bodyGroup: Konva.Group
  spanMethod: NonNullable<typeof props.spanMethod> | null
  hasSpanMethod: boolean
  globalIndexByColName: Map<string, number>
  bodyFontSize: number
}) => {
  const { rowIndex, y, bodyCols, pools, bodyGroup, spanMethod, hasSpanMethod, globalIndexByColName, bodyFontSize } =
    params

  const row = tableData.value[rowIndex]
  let x = 0

  for (let colIndex = 0; colIndex < bodyCols.length; colIndex++) {
    const columnOption = bodyCols[colIndex]

    const result = renderCell({
      pools,
      bodyGroup,
      x,
      y,
      rowIndex,
      colIndex,
      columnOption,
      row,
      bodyCols,
      spanMethod,
      hasSpanMethod,
      globalIndexByColName,
      bodyFontSize
    })

    x = result.newX
    colIndex += result.skipCols
  }
}
/**
 * 画body区域 只渲染可视区域的行
 * @param {Konva.Group | null} bodyGroup - 分组
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} bodyCols - 列
 * @param {KonvaNodePools} pools - 对象池
 * @returns {void}
 */
const drawBodyPart = (
  bodyGroup: Konva.Group | null,
  bodyCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>,
  pools: KonvaNodePools
) => {
  if (!tableVars.stage || !bodyGroup) return

  calculateVisibleRows()

  const bodyFontSize = props.bodyFontSize
  const spanMethod = typeof props.spanMethod === 'function' ? props.spanMethod : null
  const hasSpanMethod = !!spanMethod

  // 建立全局列索引映射
  const globalIndexByColName = new Map<string, number>()
  tableColumns.value.forEach((c, idx) => globalIndexByColName.set(c.columnName as string, idx))

  // 清理旧节点
  recoverKonvaNode(bodyGroup, pools)

  // 渲染可视区域的行
  for (let rowIndex = tableVars.visibleRowStart; rowIndex <= tableVars.visibleRowEnd; rowIndex++) {
    const y = rowIndex * props.bodyRowHeight
    renderRowCells({
      rowIndex,
      y,
      bodyCols,
      pools,
      bodyGroup,
      spanMethod,
      hasSpanMethod,
      globalIndexByColName,
      bodyFontSize
    })
  }

  // 渲染完成后，若存在点击高亮，保持其在最顶层
  if (tableVars.highlightRect) {
    tableVars.highlightRect.moveToTop()
    const layer = bodyGroup.getLayer()
    layer?.batchDraw()
  }
}

/**
 * 计算某列的汇总显示值
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} col - 列
 * @param {string} rule - 规则
 * @returns {Promise<string>} 汇总显示值
 */
const computeSummaryValueForColumn = async (
  col: GroupStore.GroupOption | DimensionStore.DimensionOption,
  rule: string
) => {
  if (rule === 'nodisplay') return '不显示'
  const key = col.columnName
  const values = tableData.value.map((r) => r?.[key])
  const isNumber = values.some((v) => typeof v === 'number')
  if (isNumber) {
    const nums = values
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((v) => Number.isFinite(v)) as number[]
    if (nums.length === 0) return ''
    switch (rule) {
      case 'max':
        return String(Math.max(...nums))
      case 'min':
        return String(Math.min(...nums))
      case 'avg': {
        // 使用 webworker 参与计算，避免大数据量时阻塞主线程
        try {
          const fn = new Function(
            `const nums = ${JSON.stringify(nums)}; const s = nums.reduce((a,b)=>a+b,0); return s / nums.length;`
          ) as () => number
          const result = await webworker.run<number>(fn)
          const avg = result && result.success ? result.data : nums.reduce((a, b) => a + b, 0) / nums.length
          return String(Number.isFinite(avg) ? Number(avg.toFixed(4)) : '')
        } catch {
          const s = nums.reduce((a, b) => a + b, 0)
          const avg = s / nums.length
          return String(Number.isFinite(avg) ? Number(avg.toFixed(4)) : '')
        }
      }
      case 'sum': {
        // 使用 webworker 参与计算，避免大数据量时阻塞主线程
        try {
          const fn = new Function(
            `const nums = ${JSON.stringify(nums)}; return nums.reduce((a,b)=>a+b,0);`
          ) as () => number
          const result = await webworker.run<number>(fn)
          const s = result && result.success ? result.data : nums.reduce((a, b) => a + b, 0)
          return String(Number.isFinite(s) ? s : '')
        } catch {
          const s = nums.reduce((a, b) => a + b, 0)
          return String(Number.isFinite(s) ? s : '')
        }
      }
      default:
        return ''
    }
  } else {
    const filled = values.filter((v) => v !== null && v !== undefined && String(v) !== '').length
    const empty = values.length - filled
    switch (rule) {
      case 'filled':
        return String(filled)
      case 'nofilled':
        return String(empty)
      default:
        return ''
    }
  }
}

/**
 * 汇总规则的中文标签
 * @param {string} rule - 汇总规则
 * @returns {string} 汇总规则的中文标签
 */
const getRuleLabel = (rule: string) => {
  switch (rule) {
    case 'max':
      return '最大'
    case 'min':
      return '最小'
    case 'avg':
      return '平均'
    case 'sum':
      return '求和'
    case 'filled':
      return '已填写'
    case 'nofilled':
      return '未填写'
    default:
      return ''
  }
}
/**
 * 绘制汇总部分（固定在底部，风格与表头一致，但使用 bodyTextColor）
 * @param {Konva.Group | null} summaryGroup - 分组
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} summaryCols - 列
 */
const drawSummaryPart = (
  summaryGroup: Konva.Group | null,
  summaryCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>,
  position: 'left' | 'center' | 'right' = 'left'
) => {
  if (!tableVars.stage || !summaryGroup) return
  const summaryRowHeight = props.summaryRowHeight
  const summaryBackground = props.summaryBackground
  const borderColor = props.borderColor
  const summaryFontFamily = props.summaryFontFamily
  const summaryTextColor = props.summaryTextColor
  const fontSize = props.summaryFontSize

  let x = 0
  summaryCols.forEach((col) => {
    // 直接创建汇总行矩形，不使用对象池
    const summaryCellRect = new Konva.Rect({
      name: 'summary-cell-rect',
      x,
      y: 0,
      width: col.width || 0,
      height: summaryRowHeight,
      fill: summaryBackground,
      stroke: borderColor,
      strokeWidth: 1,
      listening: true
    })
    summaryGroup.add(summaryCellRect)

    const colWidth = col.width || 0
    const textMaxWidth = colWidth - 16

    // 先显示占位文本，然后异步更新
    const rule = summaryState[col.columnName] || 'nodisplay'
    const placeholderText = rule === 'nodisplay' ? '不显示' : '计算中...'
    const truncatedTitle = truncateText(placeholderText, textMaxWidth, props.summaryFontSize, summaryFontFamily)
    
    // 直接创建汇总行文本，不使用对象池
    const summaryCellText = new Konva.Text({
      name: 'summary-cell-text',
      text: truncatedTitle,
      x,
      y: 0,
      fontSize,
      fontFamily: summaryFontFamily,
      fill: summaryTextColor,
      align: col.align || 'left',
      verticalAlign: 'middle',
      width: colWidth,
      height: summaryRowHeight
    })
    
    // 手动设置文本位置（模拟 drawUnifiedText 的 useGetTextX 逻辑）
    if (col.align === 'center') {
      summaryCellText.x(x + colWidth / 2)
      summaryCellText.offsetX(summaryCellText.width() / 2)
    } else if (col.align === 'right') {
      summaryCellText.x(x + colWidth - 8)
    } else {
      summaryCellText.x(x + 8)
    }
    
    summaryGroup.add(summaryCellText)

    // 异步计算汇总值并更新文本
    if (rule !== 'nodisplay') {
      computeSummaryValueForColumn(col, rule).then((summaryText) => {
        const ruleLabel = getRuleLabel(rule)
        const displayText = ruleLabel ? `${ruleLabel}: ${summaryText}` : summaryText
        const finalText = truncateText(displayText, textMaxWidth, props.summaryFontSize, summaryFontFamily)
        summaryCellText.text(finalText)
        const layer = summaryGroup.getLayer()
        layer?.batchDraw()
      })
    }
    // 注释悬停效果以提升性能
    summaryCellRect.on('mouseenter', () => setPointerStyle(true, 'pointer'))
    summaryCellRect.on('mouseleave', () => setPointerStyle(false, 'default'))

    summaryCellRect.on('click', (evt) => {
      if (!tableVars.stage) return
      const isNumber = col.columnType === 'number'
      const options = isNumber ? numberOptions : textOptions
      const prev = summaryState[col.columnName] || 'nodisplay'
      const valid = options.some((o) => o.value === prev) ? prev : 'nodisplay'
      // openSummaryDropdown(evt, col.columnName, options, valid)
    })

    x += colWidth
  })
}

/**
 * 全局鼠标移动处理
 * @param {MouseEvent} mouseEvent - 鼠标事件
 */
const handleGlobalMouseMove = (mouseEvent: MouseEvent) => {
  if (!tableVars.stage) return
  tableVars.stage.setPointersPositions(mouseEvent)

  // 手动拖拽导致的垂直滚动
  if (tableVars.isDraggingVerticalThumb) {
    const deltaY = mouseEvent.clientY - tableVars.dragStartY
    const { maxScrollY, maxScrollX } = getScrollLimits()
    const stageHeight = tableVars.stage.height()
    const trackHeight =
      stageHeight -
      props.headerRowHeight -
      (props.enableSummary ? props.summaryRowHeight : 0) - // 注释汇总高度
      (maxScrollX > 0 ? props.scrollbarSize : 0)
    const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * props.bodyRowHeight))
    const scrollRatio = deltaY / (trackHeight - thumbHeight)
    const newScrollY = tableVars.dragStartScrollY + scrollRatio * maxScrollY

    const oldScrollY = tableVars.stageScrollY
    tableVars.stageScrollY = constrainToRange(newScrollY, 0, maxScrollY)

    // 检查是否需要重新渲染虚拟滚动内容
    const oldVisibleStart = tableVars.visibleRowStart
    const oldVisibleEnd = tableVars.visibleRowEnd
    calculateVisibleRows()

    const needsRerender =
      tableVars.visibleRowStart !== oldVisibleStart ||
      tableVars.visibleRowEnd !== oldVisibleEnd ||
      Math.abs(tableVars.stageScrollY - oldScrollY) > props.bodyRowHeight * 5 // 配合更大的缓冲行数，减少重新渲染频率

    if (needsRerender) {
      const { leftCols, centerCols, rightCols, leftWidth, centerWidth } = getSplitColumns()
      drawBodyPart(tableVars.leftBodyGroup, leftCols, tableVars.leftBodyPools)
      drawBodyPart(tableVars.centerBodyGroup, centerCols, tableVars.centerBodyPools)
      drawBodyPart(tableVars.rightBodyGroup, rightCols, tableVars.rightBodyPools)
    }

    updateScrollPositions()
    return
  }

  // 手动拖拽导致的水平滚动
  if (tableVars.isDraggingHorizontalThumb) {
    const deltaX = mouseEvent.clientX - tableVars.dragStartX

    const { maxScrollX } = getScrollLimits()
    const { leftWidth, rightWidth, centerWidth } = getSplitColumns()
    const stageWidth = tableVars.stage.width()
    const visibleWidth = stageWidth - leftWidth - rightWidth - props.scrollbarSize
    const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / centerWidth)
    const scrollRatio = deltaX / (visibleWidth - thumbWidth)
    const newScrollX = tableVars.dragStartScrollX + scrollRatio * maxScrollX

    tableVars.stageScrollX = constrainToRange(newScrollX, 0, maxScrollX)
    updateScrollPositions()
    return
  }
}

/**
 * 全局鼠标抬起处理
 * @param {MouseEvent} mouseEvent - 鼠标事件
 */
const handleGlobalMouseUp = (mouseEvent: MouseEvent) => {
  if (tableVars.stage) tableVars.stage.setPointersPositions(mouseEvent)

  // 滚动条拖拽结束
  if (tableVars.isDraggingVerticalThumb || tableVars.isDraggingHorizontalThumb) {
    tableVars.isDraggingVerticalThumb = false
    tableVars.isDraggingHorizontalThumb = false
    setPointerStyle(false, 'default')
    if (tableVars.verticalScrollbarThumbRect && !tableVars.isDraggingVerticalThumb)
      tableVars.verticalScrollbarThumbRect.fill(props.scrollbarThumbBackground)
    if (tableVars.horizontalScrollbarThumbRect && !tableVars.isDraggingHorizontalThumb)
      tableVars.horizontalScrollbarThumbRect.fill(props.scrollbarThumbBackground)
    tableVars.scrollbarLayer?.batchDraw()
  }

  // 列宽拖拽结束 - 已注释掉
  // if (tableVars.isResizingColumn && tableVars.resizingColumnName) {
  //   const resizingColumnName = tableVars.resizingColumnName
  //   const currentWidth = tableVars.columnWidthOverrides[resizingColumnName]

  //   // 触发列宽改变事件，让父组件可以保存列宽配置
  //   if (emits && currentWidth !== undefined) {
  //     emits('column-width-change', {
  //       columnName: resizingColumnName,
  //       width: currentWidth,
  //       columnWidthOverrides: { ...tableVars.columnWidthOverrides }
  //     })
  //   }

  //   tableVars.isResizingColumn = false
  //   tableVars.resizingColumnName = null
  //   tableVars.resizeNeighborColumnName = null
  //   setPointerStyle(false, 'default')
  //   clearGroups()
  //   rebuildGroups()
  // }
}

/**
 * 全局窗口尺寸变化处理
 * @returns {void}
 */
const handleGlobalResize = () => {
  initStage()
  calculateVisibleRows()
  clearGroups()
  rebuildGroups()
}

/**
 * 清除分组 清理所有分组
 * @returns {void}
 */
const clearGroups = () => {
  tableVars.headerLayer?.destroyChildren()
  tableVars.bodyLayer?.destroyChildren()
  tableVars.fixedBodyLayer?.destroyChildren()
  tableVars.scrollbarLayer?.destroyChildren()
  tableVars.summaryLayer?.destroyChildren()
  // 清理 Body 对象池
  clearPool(tableVars.leftBodyPools.cellRects)
  clearPool(tableVars.leftBodyPools.cellTexts)
  clearPool(tableVars.centerBodyPools.cellRects)
  clearPool(tableVars.centerBodyPools.cellTexts)
  clearPool(tableVars.rightBodyPools.cellRects)
  clearPool(tableVars.rightBodyPools.cellTexts)

  /**
   * 重置滚动条引用
   * @returns {void}
   */
  tableVars.verticalScrollbarGroup = null
  tableVars.horizontalScrollbarGroup = null
  tableVars.verticalScrollbarThumbRect = null
  tableVars.horizontalScrollbarThumbRect = null

  /**
   * 重置单元格选择
   * @returns {void}
   */
  tableVars.highlightRect = null

  /**
   * 重置虚拟滚动状态
   * @returns {void}
   */
  tableVars.visibleRowStart = 0
  tableVars.visibleRowEnd = 0
  tableVars.visibleRowCount = 0

  /**
   * 重置汇总组引用
   * @returns {void}
   */
  tableVars.leftSummaryGroup = null
  tableVars.centerSummaryGroup = null
  tableVars.rightSummaryGroup = null
}


/**
 * 多列排序处理
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {'asc' | 'desc'} order - 排序方向
 * @param {number} currentIndex - 当前索引
 */
const handleMultiColumnSort = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  order: 'asc' | 'desc',
  currentIndex: number
) => {
  if (currentIndex === -1) {
    // 添加新的排序列
    sortColumns.value = [...sortColumns.value, { columnName: columnOption.columnName, order }]
  } else {
    const newSortColumns = [...sortColumns.value]
    if (newSortColumns[currentIndex].order === order) {
      // 移除该列的排序
      newSortColumns.splice(currentIndex, 1)
    } else {
      // 切换排序方向
      newSortColumns[currentIndex] = { columnName: columnOption.columnName, order }
    }
    sortColumns.value = newSortColumns
  }
}


/**
 * 单列排序处理
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {'asc' | 'desc'} order - 排序方向
 * @param {number} currentIndex - 当前索引
 */
const handleSingleColumnSort = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  order: 'asc' | 'desc',
  currentIndex: number
) => {
  if (currentIndex === -1) {
    // 设置新的排序
    sortColumns.value = [{ columnName: columnOption.columnName, order }]
  } else if (sortColumns.value[currentIndex].order === order) {
    // 取消排序
    sortColumns.value = []
  } else {
    // 切换排序方向
    sortColumns.value = [{ columnName: columnOption.columnName, order }]
  }
}

/**
 * 处理排序逻辑
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {'asc' | 'desc'} order - 排序方向
 * @param {boolean} hasModifier - 是否有修饰键
 */
const handleSortAction = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  order: 'asc' | 'desc',
  hasModifier: boolean
) => {
  const currentIndex = sortColumns.value.findIndex((s) => s.columnName === columnOption.columnName)

  if (hasModifier) {
    // 多列排序模式
    handleMultiColumnSort(columnOption, order, currentIndex)
  } else {
    // 单列排序模式
    handleSingleColumnSort(columnOption, order, currentIndex)
  }

  handleTableData(props.data)
  clearGroups()
}

/**
 * 创建排序指示器 - 上下两个箭头
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列
 * @param {number} x - 列的x坐标
 * @param {number} y - 列的y坐标
 * @param {number} width - 列的宽度
 * @param {number} height - 列的高度
 * @param {Konva.Group} headerGroup - 表头组
 * @returns {Konva.Path} 排序指示器
 */
const createSortIcon = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  x: number,
  y: number,
  width: number,
  height: number,
  headerGroup: Konva.Group
) => {
  // 检查列是否可排序
  if (!columnOption.sortable) return

  const sortOrder = getColumnSortOrder(columnOption.columnName)

  // 箭头的基础位置
  const arrowX = x + width - LAYOUT_CONSTANTS.SORT_ARROW_OFFSET
  const centerY = y + height / 2

  // 上箭头（升序）- 指向上方的三角形
  const upArrowY = centerY - LAYOUT_CONSTANTS.ARROW_GAP / 2 - LAYOUT_CONSTANTS.ARROW_SIZE
  const upArrowPath = `M ${arrowX} ${upArrowY + LAYOUT_CONSTANTS.ARROW_SIZE} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE / 2} ${upArrowY} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE} ${upArrowY + LAYOUT_CONSTANTS.ARROW_SIZE} Z`

  // 下箭头（降序）- 指向下方的三角形
  const downArrowY = centerY + LAYOUT_CONSTANTS.ARROW_GAP / 2
  const downArrowPath = `M ${arrowX} ${downArrowY} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE / 2} ${downArrowY + LAYOUT_CONSTANTS.ARROW_SIZE} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE} ${downArrowY} Z`

  // 创建上箭头
  const upArrow = new Konva.Path({
    data: upArrowPath,
    fill: sortOrder === 'asc' ? props.sortActiveColor : COLORS.INACTIVE,
    name: 'sort-indicator-up'
  })

  upArrow.on('mouseenter', () => setPointerStyle(true, 'pointer'))
  upArrow.on('mouseleave', () => setPointerStyle(false, 'default'))
  upArrow.on('click', () => {
    handleSortAction(columnOption, 'asc', false)
  })

  // 创建下箭头
  const downArrow = new Konva.Path({
    data: downArrowPath,
    fill: sortOrder === 'desc' ? props.sortActiveColor : COLORS.INACTIVE,
    name: 'sort-indicator-down'
  })

  downArrow.on('mouseenter', () => setPointerStyle(true, 'pointer'))
  downArrow.on('mouseleave', () => setPointerStyle(false, 'default'))
  downArrow.on('click', () => {
    handleSortAction(columnOption, 'desc', false)
  })

  headerGroup.add(upArrow)
  headerGroup.add(downArrow)
}


/**
 * 创建过滤图标
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} col - 列
 * @param {number} x - 列的x坐标
 * @param {number} y - 列的y坐标
 * @param {number} width - 列的宽度
 * @param {number} height - 列的高度
 * @param {Konva.Group} headerGroup - 表头组
 * @returns {Konva.Shape} 过滤图标
 */
const createFilterIcon = (
  col: GroupStore.GroupOption | DimensionStore.DimensionOption,
  x: number,
  y: number,
  width: number,
  height: number,
  headerGroup: Konva.Group
) => {
  // 检查列是否可过滤
  if (!col.filterable) {
    return
  }

  const hasFilter = !!(filterState[col.columnName] && filterState[col.columnName].size > 0)
  const filterColor = hasFilter ? props.sortActiveColor : COLORS.INACTIVE
  const filterX = x + width - LAYOUT_CONSTANTS.FILTER_ICON_OFFSET
  const centerY = y + height / 2
  const iconSize = LAYOUT_CONSTANTS.FILTER_ICON_SIZE

  const filterIcon = new Konva.Shape({
    x: filterX - iconSize / 2,
    y: centerY - iconSize / 2,
    width: iconSize,
    height: iconSize,
    listening: true,
    name: `filter-icon-${col.columnName}`,
    sceneFunc: (context, shape) => {
      context.beginPath()
      // 漏斗形状路径
      context.moveTo(2, 2)
      context.lineTo(14, 2)
      context.lineTo(11, 7)
      context.lineTo(11, 12)
      context.lineTo(5, 12)
      context.lineTo(5, 7)
      context.closePath()
      context.fillStrokeShape(shape)
    },
    stroke: filterColor,
    strokeWidth: 1.5,
    fill: hasFilter ? filterColor : 'transparent'
  })

  // 添加鼠标交互
  filterIcon.on('mouseenter', () => setPointerStyle(true, 'pointer'))
  filterIcon.on('mouseleave', () => setPointerStyle(false, 'default'))

  filterIcon.on('click', (evt) => {
    const uniqueValues = new Set<string>()
    tableData.value.forEach((row) => uniqueValues.add(String(row[col.columnName] ?? '')))

    const availableOptions = Array.from(uniqueValues)
    const currentSelection = filterState[col.columnName] ? Array.from(filterState[col.columnName]!) : []
    const allOptions = Array.from(new Set([...availableOptions, ...currentSelection]))

    // openFilterDropdown(evt, col.columnName, allOptions, currentSelection)
  })

  headerGroup.add(filterIcon)
  return filterIcon
}


/**
 * 创建列宽调整手柄
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} headerCols - 表头列配置
 * @param {number} x - x坐标
 * @param {number} colIndex - 列索引
 * @param {Konva.Group} headerGroup - 表头组
 */
const createColumnResizer = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  headerCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>,
  x: number,
  colIndex: number,
  headerGroup: Konva.Group
) => {
  const resizer = new Konva.Rect({
    x: x + (columnOption.width || 0) - LAYOUT_CONSTANTS.RESIZER_WIDTH / 2,
    y: 0,
    width: LAYOUT_CONSTANTS.RESIZER_WIDTH,
    height: props.headerRowHeight,
    fill: 'transparent',
    listening: true,
    draggable: false,
    name: `col-resizer-${columnOption.columnName}`
  })

  // 添加鼠标交互
  resizer.on('mouseenter', () => setPointerStyle(true, 'col-resize'))
  resizer.on('mouseleave', () => {
    if (!tableVars.isResizingColumn) {
      setPointerStyle(false, 'default')
    }
  })

  headerGroup.add(resizer)

  //   resizer.on('mousedown', (evt) => {
  //     tableVars.isResizingColumn = true
  //     tableVars.resizingColumnName = columnOption.columnName
  //     tableVars.resizeStartX = evt.evt.clientX
  //     tableVars.resizeStartWidth = columnOption.width || 0

  //     // 设置邻近列信息（右侧列）
  //     const neighborColumn = headerCols[colIndex + 1]
  //     if (neighborColumn) {
  //       tableVars.resizeNeighborColumnName = neighborColumn.columnName
  //       tableVars.resizeNeighborStartWidth = neighborColumn.width || 0
  //     } else {
  //       tableVars.resizeNeighborColumnName = null
  //       tableVars.resizeNeighborStartWidth = 0
  //     }

  //     setPointerStyle(true, 'col-resize')
  //   })
}


/**
 * 创建表头单元格矩形 - 添加排序功能
 * @param {number} x - 列的x坐标
 * @param {number} y - 列的y坐标
 * @param {number} width - 列的宽度
 * @param {number} height - 列的高度
 * @param {Konva.Group} headerGroup - 表头组
 * @returns {Konva.Rect} 表头单元格矩形
 */
const createHeaderCellRect = (x: number, y: number, width: number, height: number, headerGroup: Konva.Group) => {
  // 直接创建表头矩形，不使用对象池（参考汇总节点的实现方式）
  const rect = new Konva.Rect({
    name: 'header-cell-rect',
    x,
    y,
    width,
    height,
    fill: props.headerBackground,
    stroke: props.borderColor,
    strokeWidth: 1,
    listening: false
  })

  headerGroup.add(rect)

  return rect
}


/**
 * 创建表头文本 - 添加排序支持
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列
 * @param {number} x - 列的x坐标
 * @param {number} y - 列的y坐标
 * @param {number} width - 列的宽度
 * @param {number} height - 列的高度
 * @param {Konva.Group} headerGroup - 表头组
 * @returns {Konva.Text} 表头文本
 */
const createHeaderCellText = (
  columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
  x: number,
  y: number,
  width: number,
  height: number,
  headerGroup: Konva.Group
) => {
  const sortOrder = getColumnSortOrder(columnOption.columnName)
  const hasSort = sortOrder !== null

  // 如果有排序，给文本留出箭头空间
  const maxTextWidth = hasSort ? width - 32 : width - 16

  const text = truncateText(
    columnOption.displayName || columnOption.columnName,
    maxTextWidth,
    props.headerFontSize,
    props.headerFontFamily
  )

  // 直接创建表头文本，不使用对象池（参考汇总节点的实现方式）
  const headerText = new Konva.Text({
    name: 'header-cell-text',
    text,
    x,
    y,
    fontSize: props.headerFontSize,
    fontFamily: props.headerFontFamily,
    fill: props.headerTextColor,
    align: columnOption.align || 'left',
    verticalAlign: columnOption.verticalAlign || 'middle',
    width: width,
    height: height,
    listening: false
  })

  // 手动设置文本位置（模拟 drawUnifiedText 的 useGetTextX 逻辑）
  if (columnOption.align === 'center') {
    headerText.x(x + width / 2)
    headerText.offsetX(headerText.width() / 2)
  } else if (columnOption.align === 'right') {
    headerText.x(x + width - 8)
  } else {
    headerText.x(x + 8)
  }

  // 垂直居中
  if (columnOption.verticalAlign === 'middle') {
    headerText.y(y + height / 2)
    headerText.offsetY(headerText.height() / 2)
  }

  headerGroup.add(headerText)

  return headerText
}


/**
 * 绘制表头部分 - 极简版本
 * @param {Konva.Group | null} headerGroup - 表头组
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} headerCols - 表头列配置
 */
const drawHeaderPart = (
  headerGroup: Konva.Group | null,
  headerCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>
) => {
  if (!headerGroup || !tableVars.stage) return

  // 绘制简化的表头
  let x = 0
  for (let colIndex = 0; colIndex < headerCols.length; colIndex++) {
    const columnOption = headerCols[colIndex]
    const columnWidth = columnOption.width || 0

    if (columnWidth <= 0) {
      x += columnWidth
      continue
    }
    // 创建背景矩形
    createHeaderCellRect(x, 0, columnWidth, props.headerRowHeight, headerGroup)

    // 创建文本
    createHeaderCellText(columnOption, x, 0, columnWidth, props.headerRowHeight, headerGroup)

    // 添加排序icon
    createSortIcon(columnOption, x, 0, columnWidth, props.headerRowHeight, headerGroup)

    // 添加过滤icon
    createFilterIcon(columnOption, x, 0, columnWidth, props.headerRowHeight, headerGroup)

    // 添加列宽调整手柄
    createColumnResizer(columnOption, headerCols, x, colIndex, headerGroup)

    x += columnWidth
  }
}
/**
 * 设置垂直滚动条事件
 * @returns {void}
 */
const setupVerticalScrollbarEvents = () => {
  if (!tableVars.verticalScrollbarThumbRect || !tableVars.stage) return
  /**
   * 设置垂直滚动条拖拽事件
   * @returns {void}
   */

  tableVars.verticalScrollbarThumbRect.on('mousedown', (event: Konva.KonvaEventObject<MouseEvent>) => {
    tableVars.isDraggingVerticalThumb = true
    tableVars.dragStartY = event.evt.clientY
    tableVars.dragStartScrollY = tableVars.stageScrollY
    tableVars.stage!.container().style.cursor = 'grabbing'
    tableVars.stage!.setPointersPositions(event.evt)
  })
  // 启用滚动条悬停效果
  tableVars.verticalScrollbarThumbRect.on('mouseenter', () => {
    if (tableVars.verticalScrollbarThumbRect) {
      tableVars.verticalScrollbarThumbRect.fill(props.scrollbarThumbHoverBackground)
      setPointerStyle(true, 'grab')
    }
    // tableVars.scrollbarLayer?.batchDraw()
  })

  tableVars.verticalScrollbarThumbRect.on('mouseleave', () => {
    if (tableVars.verticalScrollbarThumbRect && !tableVars.isDraggingVerticalThumb) {
      tableVars.verticalScrollbarThumbRect.fill(props.scrollbarThumbBackground)
      setPointerStyle(false, 'grab')
    }
    tableVars.scrollbarLayer?.batchDraw()
  })
}

/**
   * 设置水平滚动条事件
   * @returns {void}
   */
const setupHorizontalScrollbarEvents = () => {
  if (!tableVars.horizontalScrollbarThumbRect || !tableVars.stage) return
  tableVars.horizontalScrollbarThumbRect.on('mousedown', (event: Konva.KonvaEventObject<MouseEvent>) => {
    tableVars.isDraggingHorizontalThumb = true
    tableVars.dragStartX = event.evt.clientX
    tableVars.dragStartScrollX = tableVars.stageScrollX
    tableVars.stage!.container().style.cursor = 'grabbing'
    tableVars.stage!.setPointersPositions(event.evt)
  })

  // 启用滚动条悬停效果
  tableVars.horizontalScrollbarThumbRect.on('mouseenter', () => {
    if (tableVars.horizontalScrollbarThumbRect) {
      tableVars.horizontalScrollbarThumbRect.fill(props.scrollbarThumbHoverBackground)
      setPointerStyle(true, 'grab')
    }
    tableVars.scrollbarLayer?.batchDraw()
  })

  tableVars.horizontalScrollbarThumbRect.on('mouseleave', () => {
    if (tableVars.horizontalScrollbarThumbRect && !tableVars.isDraggingHorizontalThumb) {
      tableVars.horizontalScrollbarThumbRect.fill(props.scrollbarThumbBackground)
      setPointerStyle(false, 'grab')
    }
    tableVars.scrollbarLayer?.batchDraw()
  })
}


/**
 * 创建垂直滚动条
 * @returns {void}
 */
const drawVerticalScrollbar = () => {
  if (!tableVars.stage || !tableVars.scrollbarLayer) return
  const { width: stageWidth, height: stageHeight } = getStageAttr()
  const { maxScrollX, maxScrollY } = getScrollLimits()

  // 绘制垂直滚动条顶部遮罩（覆盖表头部分）
  const verticalScrollbarTopMask = drawUnifiedRect({
    pools: tableVars.leftBodyPools,
    name: 'vertical-scrollbar-top-mask',
    x: stageWidth - props.scrollbarSize,
    y: 0,
    width: props.scrollbarSize,
    height: props.headerRowHeight,
    fill: props.headerBackground,
    stroke: props.borderColor,
    strokeWidth: 1
  })
  tableVars.scrollbarLayer.add(verticalScrollbarTopMask)

  if (summaryRowHeight.value > 0) {
    // 绘制垂直滚动条底部遮罩（覆盖汇总行部分）
    const verticalScrollbarBottomMask = drawUnifiedRect({
      pools: tableVars.leftBodyPools,
      name: 'vertical-scrollbar-bottom-mask',
      x: stageWidth - props.scrollbarSize,
      y: stageHeight - summaryRowHeight.value - (maxScrollX > 0 ? props.scrollbarSize : 0),
      width: props.scrollbarSize,
      height: summaryRowHeight.value,
      fill: props.summaryBackground,
      stroke: props.borderColor,
      strokeWidth: 1
    })
    tableVars.scrollbarLayer.add(verticalScrollbarBottomMask)
  }

  // 绘制垂直滚动条轨道
  const verticalScrollbarRect = drawUnifiedRect({
    pools: tableVars.leftBodyPools,
    name: 'vertical-scrollbar-track',
    x: stageWidth - props.scrollbarSize,
    y: props.headerRowHeight,
    width: props.scrollbarSize,
    height: stageHeight - props.headerRowHeight - summaryRowHeight.value - (maxScrollX > 0 ? props.scrollbarSize : 0),
    fill: props.scrollbarBackground,
    stroke: props.borderColor,
    strokeWidth: 1
  })
  tableVars.verticalScrollbarGroup?.add(verticalScrollbarRect)

  // 计算垂直滚动条高度
  const trackHeight =
    stageHeight - props.headerRowHeight - summaryRowHeight.value - (maxScrollX > 0 ? props.scrollbarSize : 0)
  const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * props.bodyRowHeight))
  // 计算垂直滚动条 Y 坐标
  const thumbY = props.headerRowHeight + (tableVars.stageScrollY / maxScrollY) * (trackHeight - thumbHeight)

  // 绘制垂直滚动条滑块
  tableVars.verticalScrollbarThumbRect = drawUnifiedRect({
    pools: tableVars.leftBodyPools,
    name: 'vertical-scrollbar-thumb',
    x: stageWidth - props.scrollbarSize + 2,
    y: thumbY,
    width: props.scrollbarSize - 4,
    height: thumbHeight,
    fill: props.scrollbarThumbBackground,
    cornerRadius: 2,
    listening: true
  })
  tableVars.verticalScrollbarGroup?.add(tableVars.verticalScrollbarThumbRect)

  // 设置垂直滚动条事件
  setupVerticalScrollbarEvents()
}

/**
 * 创建水平滚动条
 * @returns {void}
 */
const drawHorizontalScrollbar = () => {
  if (!tableVars.stage || !tableVars.scrollbarLayer) return
  const { width: stageWidth, height: stageHeight } = getStageAttr()
  const { maxScrollX, maxScrollY } = getScrollLimits()

  const verticalScrollbarSpaceForHorizontal = maxScrollY > 0 ? props.scrollbarSize : 0
  // 绘制水平滚动条轨道
  const horizontalScrollbarTrack = drawUnifiedRect({
    pools: tableVars.leftBodyPools,
    name: 'horizontal-scrollbar-track',
    x: 0,
    y: stageHeight - props.scrollbarSize,
    width: stageWidth - verticalScrollbarSpaceForHorizontal,
    height: props.scrollbarSize,
    fill: props.scrollbarBackground,
    stroke: props.borderColor,
    strokeWidth: 1
  })

  tableVars.horizontalScrollbarGroup?.add(horizontalScrollbarTrack)

  // 计算水平滚动条宽度
  const { leftWidth, rightWidth, centerWidth } = getSplitColumns()
  const verticalScrollbarSpaceForThumb = maxScrollY > 0 ? props.scrollbarSize : 0
  // 计算水平滚动条宽度
  const visibleWidth = stageWidth - leftWidth - rightWidth - verticalScrollbarSpaceForThumb
  const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / centerWidth)
  const thumbX = leftWidth + (tableVars.stageScrollX / maxScrollX) * (visibleWidth - thumbWidth)

  // 绘制水平滚动条滑块
  tableVars.horizontalScrollbarThumbRect = drawUnifiedRect({
    pools: tableVars.leftBodyPools,
    name: 'horizontal-scrollbar-thumb',
    x: thumbX,
    y: stageHeight - props.scrollbarSize + 2,
    width: thumbWidth,
    height: props.scrollbarSize - 4,
    fill: props.scrollbarThumbBackground,
    cornerRadius: 2,
    listening: true
  })
  tableVars.horizontalScrollbarGroup?.add(tableVars.horizontalScrollbarThumbRect)

  // 设置水平滚动条事件
  setupHorizontalScrollbarEvents()
}

/**
 * 重建分组
 * @returns {void}
 */
const rebuildGroups = () => {
  if (
    !tableVars.stage ||
    !tableVars.headerLayer ||
    !tableVars.bodyLayer ||
    !tableVars.fixedBodyLayer ||
    !tableVars.summaryLayer ||
    !tableVars.scrollbarLayer
  ) {
    return
  }

  const { leftCols, centerCols, rightCols, leftWidth, centerWidth, rightWidth } = getSplitColumns()
  const { width: stageWidth, height: stageHeight } = getStageAttr()
  const { maxScrollX, maxScrollY } = getScrollLimits()
  const verticalScrollbarWidth = maxScrollY > 0 ? props.scrollbarSize : 0
  const horizontalScrollbarHeight = maxScrollX > 0 ? props.scrollbarSize : 0

  // 为中间表头也创建裁剪组，防止表头横向滚动时遮挡固定列
  const centerHeaderClipGroup = createGroup('header', 'center', 0, 0, {
    x: 0,
    y: 0,
    width: stageWidth - rightWidth - verticalScrollbarWidth,
    height: props.headerRowHeight
  })

  tableVars.headerLayer.add(centerHeaderClipGroup)

  tableVars.leftHeaderGroup = createHeaderLeftGroups(0, 0)
  tableVars.centerHeaderGroup = createHeaderCenterGroups(leftWidth, 0)
  tableVars.rightHeaderGroup = createHeaderRightGroups(stageWidth - rightWidth - verticalScrollbarWidth, 0)
  centerHeaderClipGroup.add(tableVars.centerHeaderGroup)

  tableVars.headerLayer.add(tableVars.leftHeaderGroup, tableVars.rightHeaderGroup) // 固定表头必须在表头层，确保不被body层遮挡

  // 绘制表头
  drawHeaderPart(tableVars.leftHeaderGroup, leftCols)
  drawHeaderPart(tableVars.centerHeaderGroup, centerCols)
  drawHeaderPart(tableVars.rightHeaderGroup, rightCols)

  // 为中间可滚动区域创建裁剪组，防止遮挡固定列
  const bodyClipGroupHeight = stageHeight - props.headerRowHeight - summaryRowHeight.value - horizontalScrollbarHeight
  const bodyClipGroupWidth = stageWidth - leftWidth - rightWidth - verticalScrollbarWidth
  const centerBodyClipGroup = createGroup('body', 'center', leftWidth, props.headerRowHeight, {
    x: 0,
    y: 0,
    width: bodyClipGroupWidth,
    height: bodyClipGroupHeight
  })

  tableVars.bodyLayer.add(centerBodyClipGroup)

  tableVars.leftBodyGroup = createBodyLeftGroups(0, 0) // 现在相对于裁剪组，初始位置为0
  tableVars.centerBodyGroup = createBodyCenterGroups(-tableVars.stageScrollX, -tableVars.stageScrollY)
  tableVars.rightBodyGroup = createBodyRightGroups(0, 0) // 现在相对于裁剪组，初始位置为0

  centerBodyClipGroup.add(tableVars.centerBodyGroup)

  const leftBodyClipGroup = createGroup('body', 'left', 0, props.headerRowHeight, {
    x: 0,
    y: 0,
    width: leftWidth,
    height: bodyClipGroupHeight
  })

  const rightBodyClipGroup = createGroup(
    'body',
    'right',
    stageWidth - rightWidth - verticalScrollbarWidth,
    props.headerRowHeight,
    {
      x: 0,
      y: 0,
      width: rightWidth,
      height: bodyClipGroupHeight
    }
  )

  leftBodyClipGroup.add(tableVars.leftBodyGroup)
  rightBodyClipGroup.add(tableVars.rightBodyGroup)

  // 调整左右body组的位置，使其相对于裁剪组
  tableVars.leftBodyGroup.x(0)
  tableVars.leftBodyGroup.y(-tableVars.stageScrollY)
  tableVars.rightBodyGroup.x(0)
  tableVars.rightBodyGroup.y(-tableVars.stageScrollY)

  tableVars.fixedBodyLayer.add(leftBodyClipGroup, rightBodyClipGroup) // 添加裁剪组到固定层

  // 绘制主体
  drawBodyPart(tableVars.leftBodyGroup, leftCols, tableVars.leftBodyPools)
  drawBodyPart(tableVars.centerBodyGroup, centerCols, tableVars.centerBodyPools)
  drawBodyPart(tableVars.rightBodyGroup, rightCols, tableVars.rightBodyPools)

  // 创建汇总行组（完全参考header的实现方式）
  if (props.enableSummary) {
    const y = stageHeight - summaryRowHeight.value - horizontalScrollbarHeight

    // 为中间汇总也创建裁剪组，防止汇总横向滚动时遮挡固定列（与表头保持一致）
    const centerSummaryClipGroup = createGroup('summary', 'center', 0, y, {
      x: 0,
      y: 0,
      width: stageWidth - rightWidth - verticalScrollbarWidth,
      height: summaryRowHeight.value
    })

    tableVars.summaryLayer.add(centerSummaryClipGroup)

    tableVars.leftSummaryGroup = createSummaryLeftGroups(0, y) // 直接定位到汇总行位置
    tableVars.centerSummaryGroup = createSummaryCenterGroups(leftWidth, 0)
    tableVars.rightSummaryGroup = createSummaryRightGroups(stageWidth - rightWidth - verticalScrollbarWidth, y)

    centerSummaryClipGroup.add(tableVars.centerSummaryGroup)
    tableVars.summaryLayer.add(tableVars.leftSummaryGroup, tableVars.rightSummaryGroup)

    drawSummaryPart(tableVars.leftSummaryGroup, leftCols, 'left')
    drawSummaryPart(tableVars.centerSummaryGroup, centerCols, 'center')
    drawSummaryPart(tableVars.rightSummaryGroup, rightCols, 'right')
  } else {
    tableVars.leftSummaryGroup = null
    tableVars.centerSummaryGroup = null
    tableVars.rightSummaryGroup = null
  }

  // 创建滚动条分组
  if (maxScrollY > 0) {
    tableVars.verticalScrollbarGroup = new Konva.Group()
    tableVars.scrollbarLayer.add(tableVars.verticalScrollbarGroup)
    drawVerticalScrollbar()
  }

  if (maxScrollX > 0) {
    tableVars.horizontalScrollbarGroup = new Konva.Group()
    tableVars.scrollbarLayer.add(tableVars.horizontalScrollbarGroup)
    drawHorizontalScrollbar()
  }

  // 确保层级绘制顺序正确：固定列在上层
  tableVars.bodyLayer?.batchDraw() // 1. 先绘制可滚动的中间内容
  tableVars.fixedBodyLayer?.batchDraw() // 2. 再绘制固定列（覆盖在上面）
  tableVars.headerLayer.batchDraw() // 3. 表头在最上层
  tableVars.summaryLayer?.batchDraw() // 4. 汇总层（像header一样统一管理）
  tableVars.scrollbarLayer?.batchDraw() // 5. 滚动条在最顶层
}
/**
 * 统一的分组创建工厂方法
 * @param {'header' | 'body' | 'summary'} groupType - 分组类型
 * @param {'left' | 'center' | 'right'} position - 左中右位置
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {Object} [options] - 可选配置（如裁剪参数）
 * @param {number} options.x - 裁剪x坐标
 * @param {number} options.y - 裁剪y坐标
 * @param {number} options.width - 裁剪宽度
 * @param {number} options.height - 裁剪高度
 * @returns {Konva.Group}
 */
const createGroup = (
  groupType: 'header' | 'body' | 'summary',
  position: 'left' | 'center' | 'right',
  x: number,
  y: number,
  clip?: {
    x: number
    y: number
    width: number
    height: number
  }
): Konva.Group => {
  const groupName = `${position}-${groupType}${clip ? '-clip' : ''}-group`

  const groupConfig: Konva.GroupConfig = {
    x: position === 'left' ? 0 : x, // 左侧固定列的x永远为0
    y: position === 'center' && groupType !== 'header' ? y : groupType === 'header' ? 0 : y,
    name: groupName
  }

  // 如果是裁剪组，添加裁剪配置
  if (clip) {
    groupConfig.clip = clip
  }

  return new Konva.Group(groupConfig)
}

// 快捷方法 - 表头分组
const createHeaderLeftGroups = (x: number, y: number) => createGroup('header', 'left', x, y)
const createHeaderCenterGroups = (x: number, y: number) => createGroup('header', 'center', x, y)
const createHeaderRightGroups = (x: number, y: number) => createGroup('header', 'right', x, y)

// 快捷方法 - 表体分组
const createBodyLeftGroups = (x: number, y: number) => createGroup('body', 'left', x, y)
const createBodyCenterGroups = (x: number, y: number) => createGroup('body', 'center', x, y)
const createBodyRightGroups = (x: number, y: number) => createGroup('body', 'right', x, y)

// 快捷方法 - 汇总分组
const createSummaryLeftGroups = (x: number, y: number) => createGroup('summary', 'left', x, y)
const createSummaryCenterGroups = (x: number, y: number) => createGroup('summary', 'center', x, y)
const createSummaryRightGroups = (x: number, y: number) => createGroup('summary', 'right', x, y)

/**
 * 初始化全局事件监听器
 * @returns {void}
 */
const initStageListeners = () => {
  window.addEventListener('resize', handleGlobalResize)
  // 需要保留鼠标移动监听以支持列宽拖拽功能
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
}

/**
 * 清理全局事件监听器
 * @returns {void}
 */
const cleanupStageListeners = () => {
  window.removeEventListener('resize', handleGlobalResize)
  // 清理鼠标移动监听
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
}

/**
 * 设置列宽覆盖配置（用于从外部恢复保存的列宽）
 * @param {Record<string, number>} overrides - 列宽覆盖配置
 */
const setColumnWidthOverrides = (overrides: Record<string, number>) => {
  tableVars.columnWidthOverrides = { ...overrides }
  // 如果已经初始化，则刷新表格
  if (tableVars.stage) {
    clearGroups()
    rebuildGroups()
  }
}


/**
 * 监听 props 变化
 * @returns {void}
 */
watch(
  () => [props.xAxisFields, props.yAxisFields, props.data],
  () => {
    if (!tableVars.stage) return
    handleTableColumns(props.xAxisFields, props.yAxisFields)
    handleTableData(props.data)
    refreshTable(true)
  },
  {
    deep: true
  }
)

watch(
  () => [props.chartWidth, props.chartHeight],
  async () => {
    if (!tableVars.stage) return
    // 等待demo节点发生变更再触发该方法
    await nextTick()
    initStage()
    handleTableData(props.data)
    refreshTable(true)
  }
)

/**
 * header 相关（尺寸与样式）
 * @returns {void}
 */
watch(
  () => [
    props.headerRowHeight,
    props.headerFontFamily,
    props.headerFontSize,
    props.headerTextColor,
    props.headerBackground
  ],
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  }
)

/**
 * body 相关（行高与样式）
 * @returns {void}
 */
watch(
  () => [
    props.bodyRowHeight,
    props.bodyBackgroundOdd,
    props.bodyBackgroundEven,
    props.borderColor,
    props.bodyTextColor,
    props.bodyFontSize,
    props.bodyFontFamily
  ],
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  }
)

/**
 * 汇总行相关 - 注释以提升性能
 * @returns {void}
 */
watch(
  () => [
    props.enableSummary,
    props.summaryRowHeight,
    props.summaryFontFamily,
    props.summaryFontSize,
    props.summaryBackground,
    props.summaryTextColor
  ],
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  }
)

/**
 * 滚动条相关（样式与尺寸）
 * @returns {void}
 */
watch(
  () => [
    props.scrollbarBackground,
    props.scrollbarThumbBackground,
    props.scrollbarThumbHoverBackground,
    props.scrollbarSize
  ],
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  }
)

/**
 * 交互相关（排序指示等） - 注释高亮相关以提升性能
 * @returns {void}
 */
watch(
  () => [
    // props.enableRowHoverHighlight, // 注释以提升性能
    // props.enableColHoverHighlight, // 注释以提升性能
    props.sortActiveColor,
    props.highlightCellBackground
  ],
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  }
)

/**
 * 虚拟滚动/性能相关
 * @returns {void}
 */
watch(
  () => [props.bufferRows],
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  }
)

/**
 * 排序状态变化时重新渲染表格
 * @returns {void}
 */
watch(
  () => sortColumns.value,
  () => {
    if (!tableVars.stage) return
    refreshTable(false)
  },
  {
    deep: true
  }
)

/**
 * 更新垂直滚动
 * @param {number} offsetY - 滚动偏移量
 */
const updateVerticalScroll = (offsetY: number) => {
  if (!tableVars.stage || !tableVars.leftBodyGroup || !tableVars.centerBodyGroup || !tableVars.rightBodyGroup) return

  // 简化版本：直接使用传入的偏移量，不做累积和节流处理
  const actualOffsetY = offsetY

  const { maxScrollY } = getScrollLimits()
  tableVars.stageScrollY = constrainToRange(tableVars.stageScrollY + actualOffsetY, 0, maxScrollY)

  // 简化版本：每次滚动都重新计算和渲染
  const oldVisibleStart = tableVars.visibleRowStart
  const oldVisibleEnd = tableVars.visibleRowEnd
  calculateVisibleRows()

  const visibleRangeChanged =
    tableVars.visibleRowStart !== oldVisibleStart || tableVars.visibleRowEnd !== oldVisibleEnd

  if (visibleRangeChanged) {
    // 重新渲染可视区域
    const { leftCols, centerCols, rightCols } = getSplitColumns()

    // 批量执行重绘操作，减少单独的绘制调用
    const renderOperations = [
      () => drawBodyPart(tableVars.leftBodyGroup, leftCols, tableVars.leftBodyPools),
      () => drawBodyPart(tableVars.centerBodyGroup, centerCols, tableVars.centerBodyPools),
      () => drawBodyPart(tableVars.rightBodyGroup, rightCols, tableVars.rightBodyPools)
    ]

    // 执行所有渲染操作
    renderOperations.forEach((operation) => operation())

    // 重新绘制后，确保点击高亮矩形位于最顶层
    if (tableVars.highlightRect) {
      tableVars.highlightRect.moveToTop()
    }
  }

  // 修复：统一使用相对于裁剪组的坐标系统
  const fixedColumnsY = -tableVars.stageScrollY // 左右固定列相对于裁剪组
  const centerY = -tableVars.stageScrollY

  // 固定列和中间列随垂直滚动
  tableVars.leftBodyGroup.y(fixedColumnsY)
  tableVars.rightBodyGroup.y(fixedColumnsY)
  tableVars.centerBodyGroup.y(centerY)
  updateScrollbarPosition()
  // updateCellEditorPositionsInTable()
  scheduleLayersBatchDraw(['body', 'fixed', 'scrollbar', 'summary'])
}


/**
 * 更新水平滚动
 * @param {number} offsetX - 滚动偏移量
 */
const updateHorizontalScroll = (offsetX: number) => {
  if (!tableVars.stage || !tableVars.centerHeaderGroup || !tableVars.centerBodyGroup) return
  const { maxScrollX } = getScrollLimits()
  const { leftWidth } = getSplitColumns()
  tableVars.stageScrollX = constrainToRange(tableVars.stageScrollX + offsetX, 0, maxScrollX)

  const headerX = leftWidth - tableVars.stageScrollX
  const centerX = -tableVars.stageScrollX

  // 中间区域随横向滚动
  tableVars.centerHeaderGroup.x(headerX)
  tableVars.centerBodyGroup.x(centerX)
  tableVars.centerSummaryGroup?.x(headerX) // 修复：汇总行应该和表头使用相同的X坐标（headerX）

  updateScrollbarPosition()

  // 水平滚动需要更新表头、主体、固定列和汇总行
  scheduleLayersBatchDraw(['header', 'body', 'fixed', 'scrollbar', 'summary'])
  // updateCellEditorPositionsInTable()
  // updateFilterDropdownPositionsInTable()
  // updateSummaryDropdownPositionsInTable()
}

/**
 * 处理滚轮事件
 * @param {WheelEvent} e - 滚轮事件
 */
const handleMouseWheel = (e: WheelEvent) => {
  e.preventDefault()

  if (tableVars.stage) tableVars.stage.setPointersPositions(e)

  const hasDeltaX = Math.abs(e.deltaX) > 0
  const hasDeltaY = Math.abs(e.deltaY) > 0

  // 兼容 Shift + 滚轮用于横向滚动（常见于鼠标）
  if (e.shiftKey && !hasDeltaX && hasDeltaY) {
    updateHorizontalScroll(e.deltaY)
    return
  }

  // 实现滚动方向锁定：比较 deltaY 和 deltaX 的绝对值，只执行主要方向的滚动
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    // 主要是上下滚动
    if (hasDeltaY) {
      updateVerticalScroll(e.deltaY)
    }
  } else {
    // 主要是左右滚动
    if (hasDeltaX) {
      updateHorizontalScroll(e.deltaX)
    }
  }
}

/**
 * 初始化滚轮事件监听器
 * @returns {void}
 */
const initWheelListener = () => {
  const tableContainer = getTableContainer()
  tableContainer?.addEventListener('wheel', handleMouseWheel, { passive: false })
}

/**
 * 清理滚轮事件监听器
 * @returns {void}
 */
const cleanupWheelListener = () => {
  const tableContainer = getTableContainer()
  tableContainer?.removeEventListener('wheel', handleMouseWheel)
}

onMounted(() => {
  handleTableColumns(props.xAxisFields, props.yAxisFields)
  initStage()
  handleTableData(props.data)
  refreshTable(true)
  initWheelListener()
  initStageListeners()
  // initSummaryDropdownListeners()
  // initCellEditorListeners()
})

onUnmounted(() => {
  cleanupWheelListener()
  cleanupStageListeners()
  // cleanupSummaryDropdownListeners()
  // cleanupCellEditorListeners()
  destroyStage()
  // 清理全局实例
  // setGlobalFilterDropdownInstance(null)
})
</script>