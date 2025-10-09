import Konva from "konva";
import { createGroup, drawUnifiedRect, drawUnifiedText, getCellDisplayValue, truncateText } from "./utils";
import { type KonvaNodePools, recoverKonvaNode } from './utils'
import { stageVars, getStageSize } from "./stage-handler";
import { getSummaryRowHeight } from './summary-handler'
import { scrollbarVars } from "./scrollbar-handler";
import { staticParams, tableData } from "./parameter";

interface BodyVars {
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


    bodyLayer: Konva.Layer | null
    /**
     * 固定表body层
     */
    fixedBodyLayer: Konva.Layer | null

    /**
     * 左侧主体组
     */
    leftBodyGroup: Konva.Group | null
    /**
     * 中间主体组
     */
    centerBodyGroup: Konva.Group | null
    /**
     * 右侧主体组
     */
    rightBodyGroup: Konva.Group | null
    highlightRect: Konva.Rect | null
    visibleRowStart: number
    visibleRowEnd: number
    visibleRowCount: number

}

export const bodyVars: BodyVars = {

    leftBodyPools: {
        cellRects: [],
        cellTexts: []
    },
    centerBodyPools: {
        cellRects: [],
        cellTexts: []
    },
    rightBodyPools: {
        cellRects: [],
        cellTexts: []
    },
    bodyLayer: null,
    fixedBodyLayer: null,
    leftBodyGroup: null,
    centerBodyGroup: null,
    rightBodyGroup: null,
    /**
    * 高亮矩形
    */
    highlightRect: null,
    visibleRowStart: 0,
    visibleRowEnd: 0,
    visibleRowCount: 0
}

/**
 * 创建body左侧组
 * @param x x坐标
 * @param y y坐标
 * @returns {Konva.Group} body组
 */
export const createBodyLeftGroup = (x: number, y: number) => createGroup('body', 'left', x, y)
/**
 * 创建body中间组
 * @param x x坐标
 * @param y y坐标
 * @returns {Konva.Group} body组
 */
export const createBodyCenterGroup = (x: number, y: number) => createGroup('body', 'center', x, y)
/**
 * 创建body右侧组
 * @param x x坐标
 * @param y y坐标
 * @returns {Konva.Group} body组
 */
export const createBodyRightGroup = (x: number, y: number) => createGroup('body', 'right', x, y)

/**
 * 裁剪区域宽度高度
 */
interface ClipOptions {
    x: number
    y: number
    width: number
    height: number
}

/**
 * 创建body左侧裁剪组
 * @param x x坐标
 * @param y y坐标
 * @param {Object} clipOptions - 裁剪区域宽度高度
 * @returns {Konva.Group} body组
 */
export const createLeftBodyClipGroup = (x: number, y: number, clipOptions: ClipOptions) => createGroup('body', 'left', x, y, clipOptions)
/**
 * 创建body中间裁剪组
 * @param x x坐标
 * @param y y坐标
 * @param {Object} clipOptions - 裁剪区域宽度高度
 * @returns {Konva.Group} body组
 */
export const createCenterBodyClipGroup = (x: number, y: number, clipOptions: ClipOptions) => createGroup('body', 'center', x, y, clipOptions)
/**
 * 创建body右侧裁剪组
 * @param x x坐标
 * @param y y坐标
 * @param {Object} clipOptions - 裁剪区域宽度高度
 * @returns {Konva.Group} body组
 */
export const createRightBodyClipGroup = (x: number, y: number, clipOptions: ClipOptions) => createGroup('body', 'right', x, y, clipOptions)



/**
 * 计算可视区域数据的起始行和结束行
 * @returns {void}
 */
export const calculateVisibleRows = () => {

    if (!stageVars.stage) return

    const { height: stageHeight } = getStageSize()

    const bodyHeight = stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - staticParams.scrollbarSize

    // 计算可视区域能显示的行数
    bodyVars.visibleRowCount = Math.ceil(bodyHeight / staticParams.bodyRowHeight)

    // 根据scrollY计算起始行
    const startRow = Math.floor(scrollbarVars.stageScrollY / staticParams.bodyRowHeight)

    // 算上缓冲条数的开始下标+结束下标
    bodyVars.visibleRowStart = Math.max(0, startRow - staticParams.bufferRows)

    bodyVars.visibleRowEnd = Math.min(
        tableData.value.length - 1,
        startRow + bodyVars.visibleRowCount + staticParams.bufferRows
    )
}
/**
 * 计算列宽总和
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} columns - 列数组
 * @returns {number} 列宽总和
 */
const sumWidth = (columns: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>) => {
    return columns.reduce((acc, column) => acc + (column.width || 0), 0)
}

/**
 * 列信息存储结果
 */
interface ColumnsInfo {
    leftColumns: Array<(GroupStore.GroupOption | DimensionStore.DimensionOption) & { colIndex: number }>
    centerColumns: Array<(GroupStore.GroupOption | DimensionStore.DimensionOption) & { colIndex: number }>
    rightColumns: Array<(GroupStore.GroupOption | DimensionStore.DimensionOption) & { colIndex: number }>
    leftPartWidth: number
    centerPartWidth: number
    rightPartWidth: number
    totalWidth: number
}

/**
 * 已计算的列信息（可以直接访问使用）
 */
export const columnsInfo: ColumnsInfo = {
    leftColumns: [],
    centerColumns: [],
    rightColumns: [],
    leftPartWidth: 0,
    centerPartWidth: 0,
    rightPartWidth: 0,
    totalWidth: 0
}

/**
 * 计算并更新列信息（主动计算）
 * 应该在以下情况调用：
 * 1. Stage 初始化后
 * 2. 窗口 resize
 * 3. 列配置变化
 * 4. 数据总行数变化（影响垂直滚动条）
 */
export const calculateColumnsInfo = () => {
    console.log('🔍 计算列信息 calculateColumnsInfo')
    
    const { width: stageWidthRaw, height: stageHeightRaw } = getStageSize()
    const xAxisFields = staticParams.xAxisFields
    const yAxisFields = staticParams.yAxisFields
    const tableColumns = xAxisFields.concat(yAxisFields).map((columnOption, index) => ({
        ...columnOption,
        align: columnOption.align ?? 'left', // 添加默认值
        verticalAlign: columnOption.verticalAlign ?? 'middle', // 添加默认值
        colIndex: index
    }))

    // 计算滚动条预留宽度
    const contentHeight = tableData.value.length * staticParams.bodyRowHeight
    // 计算垂直滚动条预留空间
    const verticalScrollbarSpace =
        contentHeight > stageHeightRaw - staticParams.headerRowHeight - getSummaryRowHeight() ? staticParams.scrollbarSize : 0
    // 计算可用宽度
    const stageWidth = stageWidthRaw - verticalScrollbarSpace

    // 计算已设置宽度的列的总宽度
    const fixedWidthColumns = tableColumns.filter((c) => c.width !== undefined)
    const autoWidthColumns = tableColumns.filter((c) => c.width === undefined)
    const fixedTotalWidth = fixedWidthColumns.reduce((acc, c) => acc + (c.width || 0), 0)

    // 计算自动宽度列应该分配的宽度（所有未设置宽度的列均分剩余空间）
    const remainingWidth = Math.max(0, stageWidth - fixedTotalWidth)
    const rawAutoWidth = autoWidthColumns.length > 0 ? remainingWidth / autoWidthColumns.length : 0
    const autoColumnWidth = Math.max(staticParams.minAutoColWidth, rawAutoWidth)

    // 为未设置宽度的列分配宽度
    autoWidthColumns.forEach((col) => {
        col.width = autoColumnWidth
    })

    columnsInfo.leftColumns = tableColumns.filter((c) => c.fixed === 'left')
    columnsInfo.centerColumns = tableColumns.filter((c) => !c.fixed)
    columnsInfo.rightColumns = tableColumns.filter((c) => c.fixed === 'right')

    columnsInfo.leftPartWidth = columnsInfo.leftColumns.reduce((acc, c) => acc + (c.width || 0), 0)
    columnsInfo.centerPartWidth = columnsInfo.centerColumns.reduce((acc, c) => acc + (c.width || 0), 0)
    columnsInfo.rightPartWidth = columnsInfo.rightColumns.reduce((acc, c) => acc + (c.width || 0), 0)
    columnsInfo.totalWidth = columnsInfo.leftPartWidth + columnsInfo.centerPartWidth + columnsInfo.rightPartWidth
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
) => {
    // 绘制合并单元格背景
    drawUnifiedRect({
        pools,
        name: 'merged-cell-rect',
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        fill: rowIndex % 2 === 0 ? staticParams.bodyBackgroundOdd : staticParams.bodyBackgroundEven,
        stroke: staticParams.borderColor,
        strokeWidth: 1,
        group: bodyGroup
    })

    // 绘制合并单元格文本
    const value = getCellDisplayValue(columnOption, row, rowIndex)
    const maxTextWidth = cellWidth - 16
    const truncatedValue = truncateText(value, maxTextWidth, staticParams.bodyFontSize, staticParams.bodyFontFamily)

    drawUnifiedText({
        pools,
        name: 'merged-cell-text',
        text: truncatedValue,
        x,
        y,
        fontSize: staticParams.bodyFontSize,
        fontFamily: staticParams.bodyFontFamily,
        fill: staticParams.bodyTextColor,
        align: columnOption.align ?? 'left',
        verticalAlign: columnOption.verticalAlign ?? 'middle',
        height:cellHeight,
        width:cellWidth,
        group: bodyGroup
    })
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
) => {
    // 绘制单元格背景
    drawUnifiedRect({
        pools,
        name: 'cell-rect',
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        fill: rowIndex % 2 === 0 ? staticParams.bodyBackgroundOdd : staticParams.bodyBackgroundEven,
        stroke: staticParams.borderColor,
        strokeWidth: 1,
        group: bodyGroup
    })


    // 绘制单元格文本
    const value = getCellDisplayValue(columnOption, row, rowIndex)
    const maxTextWidth = cellWidth - 16
    const truncatedValue = truncateText(value, maxTextWidth, staticParams.bodyFontSize, staticParams.bodyFontFamily)
    drawUnifiedText({
        pools,
        name: 'cell-text',
        text: truncatedValue,
        x,
        y,
        height:cellHeight,
        width:cellWidth,
        fontSize: staticParams.bodyFontSize,
        fontFamily: staticParams.bodyFontFamily,
        fill: staticParams.bodyTextColor,
        align: columnOption.align ?? 'left',
        verticalAlign: columnOption.verticalAlign ?? 'middle',
        group: bodyGroup
    })
}



/**
 * 计算单元格合并信息
 * @param {Function} spanMethod - 合并方法
 * @param {ChartDataVo.ChartData} row - 行数据
 * @param {GroupStore.GroupOption | DimensionStore.DimensionOption} columnOption - 列配置
 * @param {number} rowIndex - 行索引
 * @returns {Object} 合并信息
 */
export const calculateCellSpan = (
    spanMethod: Function,
    row: ChartDataVo.ChartData,
    columnOption: GroupStore.GroupOption | DimensionStore.DimensionOption,
    rowIndex: number,
) => {
    const res = spanMethod({ row, column: columnOption, rowIndex, colIndex: columnOption.colIndex || 0 })
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
export const calculateMergedCellWidth = (
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
 * 画body区域 只渲染可视区域的行
 * @param {Konva.Group | null} bodyGroup - 分组
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} bodyCols - 列
 * @param {KonvaNodePools} pools - 对象池
 * @returns {void}
 */
export const drawBodyPart = (
    bodyGroup: Konva.Group | null,
    bodyCols: Array<GroupStore.GroupOption | DimensionStore.DimensionOption>,
    pools: KonvaNodePools
) => {
    if (!stageVars.stage || !bodyGroup) return

    const spanMethod = typeof staticParams.spanMethod === 'function' ? staticParams.spanMethod : null
    const hasSpanMethod = !!spanMethod

    // 清理旧节点
    recoverKonvaNode(bodyGroup, pools)

    // 渲染可视区域的行
    for (let rowIndex = bodyVars.visibleRowStart; rowIndex <= bodyVars.visibleRowEnd; rowIndex++) {
        const y = rowIndex * staticParams.bodyRowHeight
        const row = tableData.value[rowIndex]
        let x = 0

        // 渲染一行的所有列
        for (let colIndex = 0; colIndex < bodyCols.length; colIndex++) {
            const columnOption = bodyCols[colIndex]
            const columnWidth = columnOption.width || 0

            if (columnWidth <= 0) {
                x += columnWidth
                continue
            }

            // 计算合并单元格信息
            let spanRow = 1
            let spanCol = 1
            let coveredBySpanMethod = false

            if (hasSpanMethod && spanMethod) {
                const spanInfo = calculateCellSpan(spanMethod, row, columnOption, rowIndex)
                spanRow = spanInfo.spanRow
                spanCol = spanInfo.spanCol
                coveredBySpanMethod = spanInfo.coveredBySpanMethod
            }

            // 如果被合并覆盖，跳过绘制
            if (hasSpanMethod && coveredBySpanMethod) {
                x += columnWidth
                continue
            }

            const computedRowSpan = hasSpanMethod ? spanRow : 1
            const cellHeight = computedRowSpan * staticParams.bodyRowHeight
            const cellWidth = calculateMergedCellWidth(spanCol, colIndex, bodyCols, columnWidth)

            // 绘制单元格
            if (hasSpanMethod && (computedRowSpan > 1 || spanCol > 1)) {
                drawMergedCell(pools, bodyGroup, x, y, cellWidth, cellHeight, rowIndex, columnOption, row)
            } else {
                drawNormalCell(pools, bodyGroup, x, y, cellWidth, cellHeight, rowIndex, columnOption, row)
            }

            // 计算下一个位置和跳过的列数
            if (hasSpanMethod && spanCol > 1) {
                colIndex += spanCol - 1
                x += cellWidth
            } else {
                x += columnWidth
            }
        }
    }

    // 渲染完成后，若存在点击高亮，保持其在最顶层
    if (bodyVars.highlightRect) {
        bodyVars.highlightRect.moveToTop()
    }
}