import { reactive, ref, type Ref } from 'vue'
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
    createUnifiedCellRect,
    createUnifiedCellText,
} from './utils'

interface HeaderHandlerParams {
    tableData: Ref<ChartDataDao.ChartData[], ChartDataDao.ChartData[]>
}

interface HeaderVars {
    headerLayer: Konva.Layer | null,
    leftHeaderGroup: Konva.Group | null,
    centerHeaderGroup: Konva.Group | null,
    rightHeaderGroup: Konva.Group | null,
    // 列宽拖拽相关变量
    isResizingColumn: boolean
    // resizingColumnName: string | null
    // resizeStartX: number
    // resizeStartWidth: number
    // resizeNeighborColumnName: string | null
    // resizeNeighborStartWidth: number
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
const originalData = ref<Array<ChartDataVo.ChartData>>([])

/**
 * 过滤状态：列名 -> 选中的离散值集合 - 单独的响应式变量
 */
const filterState = reactive<Record<string, Set<string>>>({})

/**
 * 排序状态 - 单独的响应式变量
 */
export const sortColumns = ref<SortColumn[]>([])

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
     * 列宽拖拽相关变量
     */
    isResizingColumn: false
}

/**
 * 创建Header组 - 快捷方法
 */
export const createHeaderLeftGroups = (x: number, y: number) => createGroup('header', 'left', x, y)
export const createHeaderCenterGroups = (x: number, y: number) => createGroup('header', 'center', x, y)
export const createHeaderRightGroups = (x: number, y: number) => createGroup('header', 'right', x, y)



/**
 * 处理表格数据
 * @param {Array<ChartDataVo.ChartData>} data - 表格数据
 * @returns {void}
 */
export const handleTableData = () => {

    const data = staticParams.data
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
 * @returns {Konva.Shape} 过滤图标
 */
const createFilterIcon = (
    col: GroupStore.GroupOption | DimensionStore.DimensionOption,
    x: number,
    width: number,
    height: number,
    headerGroup: Konva.Group
) => {
    // 检查列是否可过滤
    if (!col.filterable) {
        return
    }

    const hasFilter = !!(filterState[col.columnName] && filterState[col.columnName].size > 0)
    const filterColor = hasFilter ? staticParams.sortActiveColor : COLORS.INACTIVE
    const filterX = x + width - LAYOUT_CONSTANTS.FILTER_ICON_OFFSET
    const centerY = height / 2
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
    x: number,
    headerGroup: Konva.Group
) => {
    const resizer = new Konva.Rect({
        x: x + (columnOption.width || 0) - LAYOUT_CONSTANTS.RESIZER_WIDTH / 2,
        y: 0,
        width: LAYOUT_CONSTANTS.RESIZER_WIDTH,
        height: staticParams.headerRowHeight,
        fill: 'transparent',
        listening: true,
        draggable: false,
        name: `col-resizer-${columnOption.columnName}`
    })

    // 添加鼠标交互
    resizer.on('mouseenter', () => setPointerStyle(stageVars.stage, true, 'col-resize'))
    resizer.on('mouseleave', () => {
        if (!headerVars.isResizingColumn) {
            setPointerStyle(stageVars.stage, false, 'default')
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
    width: number,
    height: number,
    headerGroup: Konva.Group
) => {
    // 检查列是否可排序
    if (!columnOption.sortable) return

    const sortOrder = getColumnSortOrder(columnOption.columnName)

    // 箭头的基础位置
    const arrowX = x + width - LAYOUT_CONSTANTS.SORT_ARROW_OFFSET
    const centerY = height / 2

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
        handleSortAction(columnOption, 'asc', false)
    })

    // 创建下箭头
    const downArrow = new Konva.Path({
        data: downArrowPath,
        fill: sortOrder === 'desc' ? staticParams.sortActiveColor : COLORS.INACTIVE,
        name: 'sort-indicator-down'
    })

    downArrow.on('mouseenter', () => setPointerStyle(stageVars.stage, true, 'pointer'))
    downArrow.on('mouseleave', () => setPointerStyle(stageVars.stage, false, 'default'))
    downArrow.on('click', () => {
        handleSortAction(columnOption, 'desc', false)
    })

    headerGroup.add(upArrow)
    headerGroup.add(downArrow)
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

    handleTableData()
    clearGroups()
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
        staticParams.headerFontSize,
        staticParams.headerFontFamily
    )

    return createUnifiedCellText({
        name: 'header-cell-text',
        text,
        x,
        y,
        width,
        height,
        fontSize: staticParams.headerFontSize,
        fontFamily: staticParams.headerFontFamily,
        fill: staticParams.headerTextColor,
        align: columnOption.align || 'left',
        verticalAlign: columnOption.verticalAlign || 'middle',
        listening: false,
        group: headerGroup
    })
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
        createUnifiedCellRect({
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
        createHeaderCellText(columnOption, x, 0, columnWidth, staticParams.headerRowHeight, headerGroup)

        // 添加排序icon
        createSortIcon(columnOption, x, columnWidth, staticParams.headerRowHeight, headerGroup)

        // 添加过滤icon
        createFilterIcon(columnOption, x, columnWidth, staticParams.headerRowHeight, headerGroup)

        // 添加列宽调整手柄
        createColumnResizer(columnOption, x, headerGroup)

        x += columnWidth
    }
}
