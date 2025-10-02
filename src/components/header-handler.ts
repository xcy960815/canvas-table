import { reactive, ref } from 'vue'
import Konva from 'konva'
import { stageVars, clearGroups } from './stage-handler'
export type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}

import { staticParams, tableData } from './parameter'

import {
    truncateText,
    setPointerStyle,
    createGroup,
    drawUnifiedRect,
    drawUnifiedText,
} from './utils'

interface HeaderVars {
    headerLayer: Konva.Layer | null,
    leftHeaderGroup: Konva.Group | null,
    centerHeaderGroup: Konva.Group | null,
    rightHeaderGroup: Konva.Group | null,
    // 列宽调整相关字段
    isResizingColumn: boolean // 是否正在调整列宽
    resizingColumnName: string | null // 正在调整的列名
    resizeStartX: number // 开始拖拽时的鼠标X坐标
    resizeStartWidth: number // 开始拖拽时的列宽
    resizeTempWidth: number // 拖拽过程中的临时宽度
    resizeIndicatorLine: Konva.Line | null // 调整指示线
}

interface SortColumn {
    columnName: string
    order: 'asc' | 'desc'
}


const LAYOUT_CONSTANTS = {
    ICON_AREA_WIDTH: 40, // 右侧图标区域预留宽度
    SORT_ARROW_OFFSET: 34, // 排序箭头距离右边缘的距离
    FILTER_ICON_OFFSET: 12, // 过滤图标距离右边缘的距离
    RESIZER_WIDTH: 6, // 列宽调整手柄宽度
    ARROW_SIZE: 8, // 排序箭头大小 (从5增加到8)
    ARROW_GAP: 2, // 上下箭头间距 (从2增加到3)
    FILTER_ICON_SIZE: 16 // 过滤图标大小
} as const


const COLORS = {
    INACTIVE: '#d0d7de'
} as const


/**
 * 原始数据存储 - 不被排序或过滤修改
 */
let originalData: Array<ChartDataVo.ChartData> = []

/**
 * 过滤状态：列名 -> 选中的离散值集合 - 单独的响应式变量
 */
const filterState = reactive<Record<string, Set<string>>>({})

/**
 * 排序状态 - 单独的响应式变量
 */
export const headerVars: HeaderVars = {
    /**
     * 表头层
     */
    headerLayer: null,
    /**
     * 左侧表头组
     */
    leftHeaderGroup: null,
    /**
     * 中间表头组
     */
    centerHeaderGroup: null,
    /**
     * 右侧表头组
     */
    rightHeaderGroup: null,
    /**
     * 列宽调整相关字段
     */
    isResizingColumn: false,
    resizingColumnName: null,
    resizeStartX: 0,
    resizeStartWidth: 0,
    resizeTempWidth: 0,
    resizeIndicatorLine: null
}

export const sortColumns = ref<SortColumn[]>([])

/**
 * 创建Header组 - 快捷方法
 */
export const createHeaderLeftGroup = (x: number, y: number) => createGroup('header', 'left', x, y)
export const createHeaderCenterGroup = (x: number, y: number) => createGroup('header', 'center', x, y)
export const createHeaderRightGroup = (x: number, y: number) => createGroup('header', 'right', x, y)
export const createHeaderClipGroup = (x: number, y: number, { width, height }: { x: number, y: number, width: number, height: number }) => createGroup('header', 'center', x, y, { x, y, width, height })


/**
 * 处理表格数据
 * @param {Array<ChartDataVo.ChartData>} data - 表格数据
 * @returns {void}
 */
export const handleTableData = () => {
    // 保存原始数据
    originalData = staticParams.data.filter((row) => row && typeof row === 'object')

    // 开始处理数据
    let processedData = [...originalData]

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
    tableData.value = processedData
}

/**
 * 获取列的排序状态
 * @param {string} columnName - 列名
 * @returns {'asc' | 'desc' | null} 排序状态
 */
const getColumnSortOrder = (columnName: string): 'asc' | 'desc' | null => {
    const sortColumn = sortColumns.value.find(col => col.columnName === columnName)
    return sortColumn ? sortColumn.order : null
}


/**
 * 创建过滤图标
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} col - 列
 * @param {number} x - 列的x坐标
 * @param {number} y - 列的y坐标
 * @param {number} width - 列的宽度
 * @param {number} height - 列的高度
 * @param {Konva.Group} headerGroup - 表头组
 */
const createFilterIcon = (
    col: GroupStore.GroupOption | DimensionStore.DimensionOption,
    x: number,
    headerGroup: Konva.Group
) => {
    // 检查列是否可过滤
    if (!col.filterable) return

    const hasFilter = !!(filterState[col.columnName] && filterState[col.columnName].size > 0)
    const filterColor = hasFilter ? staticParams.sortActiveColor : COLORS.INACTIVE
    const filterX = x + (col.width || 0) - LAYOUT_CONSTANTS.FILTER_ICON_OFFSET
    const centerY = staticParams.headerRowHeight / 2
    const iconSize = LAYOUT_CONSTANTS.FILTER_ICON_SIZE

    const filterIcon = new Konva.Shape({
        x: filterX - iconSize / 2,
        y: centerY - iconSize / 2,
        width: iconSize,
        height: iconSize,
        listening: true,
        name: `filter-icon-${col.columnName}`,
        sceneFunc: (context: Konva.Context, shape: Konva.Shape) => {
            context.beginPath()
            // 优化后的漏斗形状 - 更加圆润和对称
            const padding = 2
            const topWidth = iconSize - padding * 2
            const bottomWidth = topWidth * 0.4
            const neckHeight = iconSize * 0.6
            
            // 顶部边缘
            context.moveTo(padding, padding + 1)
            context.lineTo(padding + topWidth, padding + 1)
            
            // 右侧斜边（带圆角过渡）
            context.lineTo(padding + topWidth * 0.7, neckHeight)
            
            // 底部柱状部分（右侧）
            context.lineTo(padding + topWidth * 0.7, iconSize - padding)
            context.lineTo(padding + topWidth * 0.3, iconSize - padding)
            
            // 底部柱状部分（左侧）
            context.lineTo(padding + topWidth * 0.3, neckHeight)
            
            // 左侧斜边
            context.closePath()
            
            context.fillStrokeShape(shape)
        },
        stroke: filterColor,
        strokeWidth: 1.5,
        fill: hasFilter ? filterColor : 'transparent',
        opacity: hasFilter ? 1 : 0.6
    })

    // 添加鼠标交互
    filterIcon.on('mouseenter', () => setPointerStyle(stageVars.stage, true, 'pointer'))
    filterIcon.on('mouseleave', () => setPointerStyle(stageVars.stage, false, 'default'))

    filterIcon.on('click', (_evt: Konva.KonvaEventObject<MouseEvent>) => {
        const uniqueValues = new Set<string>()
        tableData.value.forEach((row) => uniqueValues.add(String(row[col.columnName] ?? '')))

        const availableOptions = Array.from(uniqueValues)
        const currentSelection = filterState[col.columnName] ? Array.from(filterState[col.columnName]!) : []
        const allOptions = Array.from(new Set([...availableOptions, ...currentSelection]))

        // openFilterDropdown(evt, col.columnName, allOptions, currentSelection)
    })

    headerGroup.add(filterIcon)
}

/**
 * 创建列宽调整手柄
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {number} x - x坐标
 * @param {Konva.Group} headerGroup - 表头组
 */
const createColumnResizer = (
    columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
    x: number,
    headerGroup: Konva.Group
) => {
    const resizerRect = new Konva.Rect({
        x: x + (columnOption.width || 0) - LAYOUT_CONSTANTS.RESIZER_WIDTH / 2,
        y: 0,
        width: LAYOUT_CONSTANTS.RESIZER_WIDTH,
        height: staticParams.headerRowHeight,
        fill: staticParams.borderColor,
        listening: true,
        draggable: false,
        name: `col-resizer-${columnOption.columnName}`
    })

    // 添加鼠标交互
    resizerRect.on('mouseenter', () => {
        if (!headerVars.isResizingColumn) {
            setPointerStyle(stageVars.stage, true, 'col-resize')
        }
    })
    resizerRect.on('mouseleave', () => {
        if (!headerVars.isResizingColumn) {
            setPointerStyle(stageVars.stage, false, 'default')
        }
    })

    resizerRect.on('mousedown', (evt: Konva.KonvaEventObject<MouseEvent>) => {
        headerVars.isResizingColumn = true
        headerVars.resizingColumnName = columnOption.columnName
        headerVars.resizeStartX = evt.evt.clientX
        headerVars.resizeStartWidth = columnOption.width || 0
        headerVars.resizeTempWidth = columnOption.width || 0
        setPointerStyle(stageVars.stage, true, 'col-resize')
    })

    headerGroup.add(resizerRect)
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
    headerGroup: Konva.Group
) => {
    // 检查列是否可排序
    if (!columnOption.sortable) return

    const sortOrder = getColumnSortOrder(columnOption.columnName)

    // 箭头的基础位置
    const arrowX = x + (columnOption.width || 0) - LAYOUT_CONSTANTS.SORT_ARROW_OFFSET

    const centerY = staticParams.headerRowHeight / 2

    // 上箭头（升序）- 指向上方的三角形
    const upArrowY = centerY - LAYOUT_CONSTANTS.ARROW_GAP / 2 - LAYOUT_CONSTANTS.ARROW_SIZE

    const upArrowPath = `M ${arrowX} ${upArrowY + LAYOUT_CONSTANTS.ARROW_SIZE} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE / 2} ${upArrowY} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE} ${upArrowY + LAYOUT_CONSTANTS.ARROW_SIZE} Z`

    // 下箭头（降序）- 指向下方的三角形
    const downArrowY = centerY + LAYOUT_CONSTANTS.ARROW_GAP / 2

    const downArrowPath = `M ${arrowX} ${downArrowY} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE / 2} ${downArrowY + LAYOUT_CONSTANTS.ARROW_SIZE} L ${arrowX + LAYOUT_CONSTANTS.ARROW_SIZE} ${downArrowY} Z`

    // 创建上箭头
    const upArrow = new Konva.Path({
        data: upArrowPath,
        fill: sortOrder === 'asc' ? staticParams.sortActiveColor : COLORS.INACTIVE,
        name: 'sort-indicator-up'
    })

    upArrow.on('mouseenter', () => setPointerStyle(stageVars.stage, true, 'pointer'))
    upArrow.on('mouseleave', () => setPointerStyle(stageVars.stage, false, 'default'))
    upArrow.on('click', (_evt: Konva.KonvaEventObject<MouseEvent>) => {
        handleSortAction(columnOption, 'asc')
    })

    // 创建下箭头
    const downArrow = new Konva.Path({
        data: downArrowPath,
        fill: sortOrder === 'desc' ? staticParams.sortActiveColor : COLORS.INACTIVE,
        name: 'sort-indicator-down'
    })

    downArrow.on('mouseenter', () => setPointerStyle(stageVars.stage, true, 'pointer'))
    downArrow.on('mouseleave', () => setPointerStyle(stageVars.stage, false, 'default'))
    downArrow.on('click', (_evt: Konva.KonvaEventObject<MouseEvent>) => {
        handleSortAction(columnOption, 'desc')
    })

    headerGroup.add(upArrow)
    headerGroup.add(downArrow)
}


/**
 * 处理排序逻辑
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {'asc' | 'desc'} order - 排序方向
 */
const handleSortAction = (
    columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
    order: 'asc' | 'desc'
) => {
    const currentIndex = sortColumns.value.findIndex((s) => s.columnName === columnOption.columnName)
    handleMultiColumnSort(columnOption, order, currentIndex)

    handleTableData()
    clearGroups()
}


/**
 * 创建表头文本 - 添加排序支持
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列
 * @param {number} x - 列的x坐标
 * @param {number} width - 列的宽度
 * @param {number} height - 列的高度
 * @param {Konva.Group} headerGroup - 表头组
 */
const createHeaderCellText = (
    columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
    x: number,
    headerGroup: Konva.Group
) => {
    const sortOrder = getColumnSortOrder(columnOption.columnName)
    const hasSort = sortOrder !== null

    // 如果有排序，给文本留出箭头空间
    const maxTextWidth = hasSort ? (columnOption.width || 0) - 32 : (columnOption.width || 0) - 16

    const text = truncateText(
        columnOption.displayName || columnOption.columnName,
        maxTextWidth,
        staticParams.headerFontSize,
        staticParams.headerFontFamily
    )

    drawUnifiedText({
        name: 'header-cell-text',
        text,
        x,
        y: 0,
        width: columnOption.width || 0,
        height: staticParams.headerRowHeight,
        fontSize: staticParams.headerFontSize,
        fontFamily: staticParams.headerFontFamily,
        fill: staticParams.headerTextColor,
        align: columnOption.align ?? 'left',
        verticalAlign: columnOption.verticalAlign ?? 'middle',
        group: headerGroup
    })
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
 * 绘制表头部分 - 极简版本
 * @param {Konva.Group | null} headerGroup - 表头组
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} headerCols - 表头列配置
 */
export const drawHeaderPart = (
    headerGroup: Konva.Group | null,
    headerCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>
) => {
    if (!headerGroup || !stageVars.stage) return

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
        drawUnifiedRect({
            name: 'header-cell-rect',
            x,
            y: 0,
            width: columnWidth,
            height: staticParams.headerRowHeight,
            fill: staticParams.headerBackground,
            stroke: staticParams.borderColor,
            strokeWidth: 1,
            listening: false,
            group: headerGroup
        })

        // 创建文本
        createHeaderCellText(columnOption, x, headerGroup)

        // 添加排序icon
        createSortIcon(columnOption, x, headerGroup)

        // 添加过滤icon
        createFilterIcon(columnOption, x, headerGroup)

        // 添加列宽调整手柄
        createColumnResizer(columnOption, x, headerGroup)

        x += columnWidth
    }
}
