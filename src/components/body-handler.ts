import Konva from "konva";
import {
    type KonvaNodePools,
    createGroup,
    recoverKonvaNode,
    drawUnifiedRect,
    drawUnifiedText,
    getCellDisplayValue,
    truncateText,
} from "./utils";
import { stageVars, getStageAttr } from "./stage-handler";
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

// 快捷方法 - 表体分组
export const createBodyLeftGroup = (x: number, y: number) => createGroup('body', 'left', x, y)
export const createBodyCenterGroup = (x: number, y: number) => createGroup('body', 'center', x, y)
export const createBodyRightGroup = (x: number, y: number) => createGroup('body', 'right', x, y)
interface ClipOptions {
    x: number
    y: number
    width: number
    height: number
}
export const createLeftBodyClipGroup = (x: number, y: number, clipOptions: ClipOptions) => createGroup('body', 'left', x, y, clipOptions)
export const createCenterBodyClipGroup = (x: number, y: number, clipOptions: ClipOptions) => createGroup('body', 'center', x, y, clipOptions)
export const createRightBodyClipGroup = (x: number, y: number, clipOptions: ClipOptions) => createGroup('body', 'right', x, y, clipOptions)

export const getSummaryRowHeight = () => (staticParams.enableSummary ? staticParams.summaryRowHeight : 0)

/**
 * 计算可视区域数据的起始行和结束行
 * @returns {void}
 */
export const calculateVisibleRows = () => {

    if (!stageVars.stage) return

    const { height: stageHeight } = getStageAttr()

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
 * 计算左右固定列与中间列的分组与宽度汇总
 * @returns {Object} 分组与宽度汇总
 */
export const getColumnsInfo = () => {
    const xAxisFields = staticParams.xAxisFields
    const yAxisFields = staticParams.yAxisFields
    const tableColumns = xAxisFields.concat(yAxisFields)

    // 计算滚动条预留宽度 高度
    // const { width: stageWidthRaw, height: stageHeightRaw } = getStageAttr()
    // 计算内容高度
    // const contentHeight = tableData.value.length * staticParams.bodyRowHeight
    // 计算垂直滚动条预留空间
    // const verticalScrollbarSpace =
    //     contentHeight > stageHeightRaw - staticParams.headerRowHeight - staticParams.summaryRowHeight ? staticParams.scrollbarSize : 0
    // 计算内容宽度
    // const stageWidth = stageWidthRaw - verticalScrollbarSpace

    // 计算已设置宽度的列的总宽度
    // const fixedWidthColumns = tableColumns.filter((c) => c.width !== undefined)
    // const autoWidthColumns = tableColumns.filter((c) => c.width === undefined)
    // const fixedTotalWidth = fixedWidthColumns.reduce((acc, c) => acc + (c.width || 0), 0)

    // 计算自动宽度列应该分配的宽度
    // const remainingWidth = Math.max(0, stageWidth - fixedTotalWidth)
    // const rawAutoWidth = autoWidthColumns.length > 0 ? remainingWidth / autoWidthColumns.length : 0
    // const autoColumnWidth = Math.max(staticParams.minAutoColWidth, rawAutoWidth)
    const leftColumns = tableColumns.map((columnOption, index) => ({ ...columnOption, index })).filter((c) => c.fixed === 'left')
    const centerColumns = tableColumns.map((columnOption, index) => ({ ...columnOption, index })).filter((c) => !c.fixed)
    const rightColumns = tableColumns.map((columnOption, index) => ({ ...columnOption, index })).filter((c) => c.fixed === 'right')

    return {
        leftColumns,
        centerColumns,
        rightColumns,
        leftPartWidth: sumWidth(leftColumns),
        centerPartWidth: sumWidth(centerColumns),
        rightPartWidth: sumWidth(rightColumns),
        totalWidth: sumWidth(tableColumns)
    }
}
/**
 * 获取滚动限制
 * @returns {Object} 滚动限制
 */
export const getScrollLimits = () => {
    if (!stageVars.stage) return { maxScrollX: 0, maxScrollY: 0 }
    const { totalWidth, leftPartWidth, rightPartWidth } = getColumnsInfo()

    const { width: stageWidth, height: stageHeight } = getStageAttr()

    // 计算内容高度
    const contentHeight = tableData.value.length * staticParams.bodyRowHeight

    // 初步估算：不预留滚动条空间
    const visibleContentWidthNoV = stageWidth - leftPartWidth - rightPartWidth
    const contentHeightNoH = stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight
    const prelimMaxX = Math.max(0, totalWidth - leftPartWidth - rightPartWidth - visibleContentWidthNoV)
    const prelimMaxY = Math.max(0, contentHeight - contentHeightNoH)
    const verticalScrollbarSpace = prelimMaxY > 0 ? staticParams.scrollbarSize : 0
    const horizontalScrollbarSpace = prelimMaxX > 0 ? staticParams.scrollbarSize : 0
    // 复算：考虑另一条滚动条占位
    const visibleContentWidth = stageWidth - leftPartWidth - rightPartWidth - verticalScrollbarSpace
    const maxScrollX = Math.max(0, totalWidth - leftPartWidth - rightPartWidth - visibleContentWidth)
    const maxScrollY = Math.max(
        0,
        contentHeight - (stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight - horizontalScrollbarSpace)
    )

    return { maxScrollX, maxScrollY }
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
        fill: rowIndex % 2 === 0 ? staticParams.bodyBackgroundOdd : staticParams.bodyBackgroundEven,
        stroke: staticParams.borderColor,
        strokeWidth: 1
    })
    bodyGroup.add(mergedCellRect)

    // 绘制合并单元格文本
    const value = getCellDisplayValue(columnOption, row, rowIndex)
    const maxTextWidth = cellWidth - 16
    const truncatedValue = truncateText(value, maxTextWidth, bodyFontSize, staticParams.bodyFontFamily)

    const mergedCellText = drawUnifiedText({
        pools,
        name: 'merged-cell-text',
        text: truncatedValue,
        x,
        y,
        fontSize: bodyFontSize,
        fontFamily: staticParams.bodyFontFamily,
        fill: staticParams.bodyTextColor,
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
        fill: rowIndex % 2 === 0 ? staticParams.bodyBackgroundOdd : staticParams.bodyBackgroundEven,
        stroke: staticParams.borderColor,
        strokeWidth: 1
    })

    // cellRect.off('click.cell')
    // cellRect.on('click.cell', handleClick)
    bodyGroup.add(cellRect)

    // 绘制单元格文本
    const value = getCellDisplayValue(columnOption, row, rowIndex)
    const maxTextWidth = cellWidth - 16
    const truncatedValue = truncateText(value, maxTextWidth, bodyFontSize, staticParams.bodyFontFamily)

    const cellText = drawUnifiedText({
        pools,
        name: 'cell-text',
        text: truncatedValue,
        x,
        y,
        fontSize: bodyFontSize,
        fontFamily: staticParams.bodyFontFamily,
        fill: staticParams.bodyTextColor,
        align: columnOption.align || 'left',
        verticalAlign: 'middle',
        cellHeight,
        useGetTextX: true
    })
    bodyGroup.add(cellText)
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
    const res = spanMethod({ row, column: columnOption, rowIndex, colIndex: columnOption.index })
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
 * 渲染单行的所有单元格
 * @param {Object} params - 渲染参数
 * @param {number} params.rowIndex - 行索引
 * @param {number} params.y - y坐标
 * @param {Array<GroupStore.GroupOption | DimensionStore.DimensionOption>} params.bodyCols - 列配置数组
 * @param {KonvaNodePools} params.pools - 对象池
 * @param {Konva.Group} params.bodyGroup - 主体组
 * @param {NonNullable<typeof staticParams.spanMethod> | null} params.spanMethod - 合并方法
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
    spanMethod: NonNullable<typeof staticParams.spanMethod> | null
    hasSpanMethod: boolean
    bodyFontSize: number
}) => {
    const { rowIndex, y, bodyCols, pools, bodyGroup, spanMethod, hasSpanMethod, bodyFontSize } =
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
            bodyFontSize
        })

        x = result.newX
        colIndex += result.skipCols
    }
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
 * @param {NonNullable<typeof staticParams.spanMethod> | null} params.spanMethod - 合并方法
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
    spanMethod: NonNullable<typeof staticParams.spanMethod> | null
    hasSpanMethod: boolean
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
        bodyFontSize
    } = params

    const columnWidth = columnOption.width || 0
    if (columnWidth <= 0) return { newX: x + columnWidth, skipCols: 0 }

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
        return { newX: x + columnWidth, skipCols: 0 }
    }

    const computedRowSpan = hasSpanMethod ? spanRow : 1
    const cellHeight = computedRowSpan * staticParams.bodyRowHeight
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

    calculateVisibleRows()

    const bodyFontSize = staticParams.bodyFontSize
    const spanMethod = typeof staticParams.spanMethod === 'function' ? staticParams.spanMethod : null
    const hasSpanMethod = !!spanMethod
    // 清理旧节点
    recoverKonvaNode(bodyGroup, pools)

    // 渲染可视区域的行
    for (let rowIndex = bodyVars.visibleRowStart; rowIndex <= bodyVars.visibleRowEnd; rowIndex++) {
        const y = rowIndex * staticParams.bodyRowHeight
        renderRowCells({
            rowIndex,
            y,
            bodyCols,
            pools,
            bodyGroup,
            spanMethod,
            hasSpanMethod,
            bodyFontSize
        })
    }

    // 渲染完成后，若存在点击高亮，保持其在最顶层
    if (bodyVars.highlightRect) {
        bodyVars.highlightRect.moveToTop()
        // const layer = bodyGroup.getLayer()
        // layer?.batchDraw()
    }
}