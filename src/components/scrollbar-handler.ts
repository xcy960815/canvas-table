import Konva from "konva";
import { stageVars, getStageAttr } from "./stage-handler";
import { staticParams, tableData } from "./parameter";
import { headerVars } from "./header-handler";
import { bodyVars, getSummaryRowHeight, calculateVisibleRows, getScrollLimits, getSplitColumns, drawBodyPart } from "./body-handler";
import { summaryVars } from "./summary-handler";
import {
    getTableContainer,
    setPointerStyle,
    constrainToRange,
    createUnifiedCellRect,
} from './utils'

interface ScrollbarVars {
    scrollbarLayer: Konva.Layer | null,
    verticalScrollbarGroup: Konva.Group | null,
    horizontalScrollbarGroup: Konva.Group | null,
    verticalScrollbarThumb: Konva.Rect | null,
    horizontalScrollbarThumb: Konva.Rect | null,
    isDraggingVerticalThumb: boolean
    isDraggingHorizontalThumb: boolean
    dragStartY: number
    dragStartX: number
    stageScrollY: number
    stageScrollX: number
    dragStartScrollY: number
    dragStartScrollX: number
}

export const scrollbarVars: ScrollbarVars = {
    /**
   * 滚动条层（滚动条）
   */
    scrollbarLayer: null,

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
    verticalScrollbarThumb: null,

    /**
     * 水平滚动条滑块
     */
    horizontalScrollbarThumb: null,


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

    /**
   * 垂直滚动多少像素
   */
    stageScrollY: 0,

    /**
     * 水平滚动多少像素
     */
    stageScrollX: 0,

}

/**
 * 修复的Layer批量绘制 - 5个真实的Layer，确保表头和汇总固定
 * @param {Array<'header' | 'body' | 'fixed' | 'scrollbar' | 'summary'>} layers - 要绘制的层
 */
export const scheduleLayersBatchDraw = (layers: Array<'header' | 'body' | 'fixed' | 'scrollbar' | 'summary'> = ['body']) => {
    // 简化版本：直接执行绘制，不使用批量优化
    layers.forEach((layerType) => {
        switch (layerType) {
            // 表头相关
            case 'header':
                headerVars.headerLayer?.batchDraw() // 表头层（固定不滚动）
                break

            // 主体相关
            case 'body':
                bodyVars.bodyLayer?.batchDraw() // 主体内容层（可滚动）
                break
            case 'fixed':
                bodyVars.fixedBodyLayer?.batchDraw() // 固定列层（左右固定）
                break

            // 汇总相关
            case 'summary':
                summaryVars.summaryLayer?.batchDraw() // 汇总行层（底部固定）
                break

            // 滚动条相关
            case 'scrollbar':
                scrollbarVars.scrollbarLayer?.batchDraw() // 滚动条层
                break
        }
    })
}

/**
 * 更新滚动位置
 * @returns {void}
 */
export const updateScrollPositions = () => {
    if (
        !bodyVars.leftBodyGroup ||
        !bodyVars.centerBodyGroup ||
        !bodyVars.rightBodyGroup ||
        !headerVars.centerHeaderGroup
    )
        return
    const centerX = -scrollbarVars.stageScrollX
    const headerX = -scrollbarVars.stageScrollX

    // 主体相关 - 更新滚动位置
    /**
     * 更新左侧和右侧主体（只有 Y 位置变化）
     * 注意：由于左右body组现在在裁剪组中，Y位置应该相对于裁剪组
     * @returns {void}
     */
    bodyVars.leftBodyGroup.y(-scrollbarVars.stageScrollY)
    bodyVars.rightBodyGroup.y(-scrollbarVars.stageScrollY)

    /**
     * 更新中间主体（X 和 Y 位置变化）
     * @returns {void}
     */
    bodyVars.centerBodyGroup.x(centerX)
    bodyVars.centerBodyGroup.y(-scrollbarVars.stageScrollY)

    /**
     * 更新中心表头（只有 X 位置变化）
     * @returns {void}
     */
    headerVars.centerHeaderGroup.x(headerX)

    /**
     * 更新汇总组位置（完全参考表头的实现方式）
     * 左右汇总组：固定位置，不滚动
     * 中间汇总组：在裁剪组中，只需要更新x位置跟随滚动
     * @returns {void}
     */
    if (summaryVars.leftSummaryGroup) {
        // 左侧汇总组：固定位置，不需要更新（与左侧表头一样）
        // 位置已在创建时设置，保持不变
    }
    if (summaryVars.rightSummaryGroup) {
        // 右侧汇总组：固定位置，不需要更新（与右侧表头一样）
        // 位置已在创建时设置，保持不变
    }
    if (summaryVars.centerSummaryGroup) {
        // 中间汇总组：在裁剪组中，需要跟随水平滚动（与中间表头一致）
        summaryVars.centerSummaryGroup.x(headerX)
        summaryVars.centerSummaryGroup.y(0) // 相对于裁剪组
    }

    updateScrollbarPosition()

    // 水平滚动时也需要重绘固定层
    scheduleLayersBatchDraw(['body', 'fixed', 'scrollbar', 'summary'])
    // updateFilterDropdownPositionsInTable()
    // updateSummaryDropdownPositionsInTable()
}

/**
 * 更新水平滚动
 * @param {number} offsetX - 滚动偏移量
 */
export const updateHorizontalScroll = (offsetX: number) => {
    if (!stageVars.stage || !headerVars.centerHeaderGroup || !bodyVars.centerBodyGroup) return
    const { maxScrollX } = getScrollLimits()
    const { leftWidth } = getSplitColumns()
    scrollbarVars.stageScrollX = constrainToRange(scrollbarVars.stageScrollX + offsetX, 0, maxScrollX)

    const headerX = leftWidth - scrollbarVars.stageScrollX
    const centerX = -scrollbarVars.stageScrollX

    // 主体相关 - 中间区域随横向滚动
    headerVars.centerHeaderGroup.x(headerX)
    bodyVars.centerBodyGroup?.x(centerX)
    summaryVars.centerSummaryGroup?.x(headerX) // 修复：汇总行应该和表头使用相同的X坐标（headerX）

    updateScrollbarPosition()

    // 水平滚动需要更新表头、主体、固定列和汇总行
    scheduleLayersBatchDraw(['header', 'body', 'fixed', 'scrollbar', 'summary'])
    // updateCellEditorPositionsInTable()
    // updateFilterDropdownPositionsInTable()
    // updateSummaryDropdownPositionsInTable()
}


/**
 * 更新垂直滚动
 * @param {number} offsetY - 滚动偏移量
 */
export const updateVerticalScroll = (offsetY: number) => {
    if (!stageVars.stage || !bodyVars.leftBodyGroup || !bodyVars.centerBodyGroup || !bodyVars.rightBodyGroup) return

    const actualOffsetY = offsetY

    const { maxScrollY } = getScrollLimits()

    scrollbarVars.stageScrollY = constrainToRange(scrollbarVars.stageScrollY + actualOffsetY, 0, maxScrollY)

    const oldVisibleStart = bodyVars.visibleRowStart

    const oldVisibleEnd = bodyVars.visibleRowEnd

    calculateVisibleRows()

    const visibleRangeChanged =
        bodyVars.visibleRowStart !== oldVisibleStart || bodyVars.visibleRowEnd !== oldVisibleEnd

    if (visibleRangeChanged) {
        // 重新渲染可视区域
        const { leftCols, centerCols, rightCols } = getSplitColumns()

        // 主体相关 - 批量执行重绘操作，减少单独的绘制调用
        const renderOperations = [
            () => drawBodyPart(bodyVars.leftBodyGroup, leftCols, bodyVars.leftBodyPools),
            () => drawBodyPart(bodyVars.centerBodyGroup, centerCols, bodyVars.centerBodyPools),
            () => drawBodyPart(bodyVars.rightBodyGroup, rightCols, bodyVars.rightBodyPools)
        ]

        // 执行所有渲染操作
        renderOperations.forEach((operation) => operation())

        // 重新绘制后，确保点击高亮矩形位于最顶层
        if (bodyVars.highlightRect) {
            bodyVars.highlightRect.moveToTop()
        }
    }

    // 修复：统一使用相对于裁剪组的坐标系统
    const fixedColumnsY = -scrollbarVars.stageScrollY // 左右固定列相对于裁剪组
    const centerY = -scrollbarVars.stageScrollY

    // 主体相关 - 固定列和中间列随垂直滚动
    bodyVars.leftBodyGroup.y(fixedColumnsY)
    bodyVars.rightBodyGroup?.y(fixedColumnsY)
    bodyVars.centerBodyGroup.y(centerY)
    updateScrollbarPosition()
    // updateCellEditorPositionsInTable()
    scheduleLayersBatchDraw(['body', 'fixed', 'scrollbar', 'summary'])
}
/**
 * 设置垂直滚动条事件
 * @returns {void}
 */
const setupVerticalScrollbarEvents = () => {

    if (!scrollbarVars.verticalScrollbarThumb || !stageVars.stage) return
    /**
     * 设置垂直滚动条拖拽事件
     * @returns {void}
     */

    scrollbarVars.verticalScrollbarThumb.on('mousedown', (event: Konva.KonvaEventObject<MouseEvent>) => {
        scrollbarVars.isDraggingVerticalThumb = true
        scrollbarVars.dragStartY = event.evt.clientY
        scrollbarVars.dragStartScrollY = scrollbarVars.stageScrollY
        setPointerStyle(stageVars.stage, true, 'grabbing')
        stageVars.stage?.setPointersPositions(event.evt)
    })
    // 启用滚动条悬停效果
    if (!!scrollbarVars.verticalScrollbarThumb) {
        scrollbarVars.verticalScrollbarThumb.on('mouseenter', () => {
            scrollbarVars.verticalScrollbarThumb?.fill(staticParams.scrollbarThumbHoverBackground)
            setPointerStyle(stageVars.stage, true, 'grab')
            // tableVars.scrollbarLayer?.batchDraw()
        })
    }

    if (scrollbarVars.verticalScrollbarThumb && !scrollbarVars.isDraggingVerticalThumb) {
        scrollbarVars.verticalScrollbarThumb.on('mouseleave', () => {
            scrollbarVars.verticalScrollbarThumb?.fill(staticParams.scrollbarThumbBackground)
            setPointerStyle(stageVars.stage, false, 'grab')
            // tableVars.scrollbarLayer?.batchDraw()
        })
    }
}

/**
 * 更新滚动条位置
 * @returns {void}
 */
export const updateScrollbarPosition = () => {
    if (!stageVars.stage) return

    const { width: stageWidth, height: stageHeight } = getStageAttr()
    const { maxScrollX, maxScrollY } = getScrollLimits()

    // 更新垂直滚动条位置
    if (scrollbarVars.verticalScrollbarThumb && maxScrollY > 0) {
        const trackHeight =
            stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight - (maxScrollX > 0 ? staticParams.scrollbarSize : 0)
        const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * staticParams.bodyRowHeight))
        const thumbY = staticParams.headerRowHeight + (scrollbarVars.stageScrollY / maxScrollY) * (trackHeight - thumbHeight)
        scrollbarVars.verticalScrollbarThumb.y(thumbY)
    }

    // 更新水平滚动条位置
    if (scrollbarVars.horizontalScrollbarThumb && maxScrollX > 0) {
        const { leftWidth, rightWidth, centerWidth } = getSplitColumns()
        const visibleWidth = stageWidth - leftWidth - rightWidth - (maxScrollY > 0 ? staticParams.scrollbarSize : 0)
        const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / centerWidth)
        const thumbX = leftWidth + (scrollbarVars.stageScrollX / maxScrollX) * (visibleWidth - thumbWidth)
        scrollbarVars.horizontalScrollbarThumb.x(thumbX)
    }

    scrollbarVars.scrollbarLayer?.batchDraw()
}

/**
 * 创建垂直滚动条
 * @returns {void}
 */
export const drawVerticalScrollbar = () => {
    
    if (!stageVars.stage || !scrollbarVars.scrollbarLayer) return

    const { width: stageWidth, height: stageHeight } = getStageAttr()

    const { maxScrollX, maxScrollY } = getScrollLimits()

    // 绘制垂直滚动条顶部遮罩（覆盖表头部分）
    createUnifiedCellRect({
        name: 'vertical-scrollbar-top-mask',
        x: stageWidth - staticParams.scrollbarSize,
        y: 0,
        width: staticParams.scrollbarSize,
        height: staticParams.headerRowHeight,
        fill: staticParams.headerBackground,
        stroke: staticParams.borderColor,
        strokeWidth: 1,
        listening: false,
        group: scrollbarVars.scrollbarLayer
    })

    if (getSummaryRowHeight()) {
        // 绘制垂直滚动条底部遮罩（覆盖汇总行部分）
        createUnifiedCellRect({
            name: 'vertical-scrollbar-bottom-mask',
            x: stageWidth - staticParams.scrollbarSize,
            y: stageHeight - getSummaryRowHeight() - (maxScrollX > 0 ? staticParams.scrollbarSize : 0),
            width: staticParams.scrollbarSize,
            height: getSummaryRowHeight(),
            fill: staticParams.summaryBackground,
            stroke: staticParams.borderColor,
            strokeWidth: 1,
            listening: false,
            group: scrollbarVars.scrollbarLayer
        })
    }

    // 绘制垂直滚动条轨道
    createUnifiedCellRect({
        name: 'vertical-scrollbar-track',
        x: stageWidth - staticParams.scrollbarSize,
        y: staticParams.headerRowHeight,
        width: staticParams.scrollbarSize,
        height: stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - (maxScrollX > 0 ? staticParams.scrollbarSize : 0),
        fill: staticParams.scrollbarBackground,
        stroke: staticParams.borderColor,
        strokeWidth: 1,
        listening: false,
        group: scrollbarVars.verticalScrollbarGroup!
    })

    // 计算垂直滚动条高度
    const trackHeight =
        stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - (maxScrollX > 0 ? staticParams.scrollbarSize : 0)
    const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * staticParams.bodyRowHeight))
    // 计算垂直滚动条 Y 坐标
    const thumbY = staticParams.headerRowHeight + (scrollbarVars.stageScrollY / maxScrollY) * (trackHeight - thumbHeight)

    // 绘制垂直滚动条滑块
    scrollbarVars.verticalScrollbarThumb = createUnifiedCellRect({
        name: 'vertical-scrollbar-thumb',
        x: stageWidth - staticParams.scrollbarSize + 2,
        y: thumbY,
        width: staticParams.scrollbarSize - 4,
        height: thumbHeight,
        fill: staticParams.scrollbarThumbBackground,
        cornerRadius: 2,
        listening: true,
        stroke: staticParams.borderColor,
        strokeWidth: 0,
        group: scrollbarVars.verticalScrollbarGroup!
    })

    // 设置垂直滚动条事件
    setupVerticalScrollbarEvents()
}


/**
 * 设置水平滚动条事件
 * @returns {void}
 */
const setupHorizontalScrollbarEvents = () => {
    if (!scrollbarVars.horizontalScrollbarThumb || !stageVars.stage) return
    scrollbarVars.horizontalScrollbarThumb.on('mousedown', (event: Konva.KonvaEventObject<MouseEvent>) => {
        scrollbarVars.isDraggingHorizontalThumb = true
        scrollbarVars.dragStartX = event.evt.clientX
        scrollbarVars.dragStartScrollX = scrollbarVars.stageScrollX
        setPointerStyle(stageVars.stage, true, 'grabbing')
        stageVars.stage?.setPointersPositions(event.evt)
    })

    // 启用滚动条悬停效果
    scrollbarVars.horizontalScrollbarThumb.on('mouseenter', () => {
        if (!!scrollbarVars.horizontalScrollbarThumb) {
            scrollbarVars.horizontalScrollbarThumb.fill(staticParams.scrollbarThumbHoverBackground)
            setPointerStyle(stageVars.stage, true, 'grab')
        }
        // scrollbarVars.scrollbarLayer?.batchDraw()
    })

    scrollbarVars.horizontalScrollbarThumb.on('mouseleave', () => {
        if (scrollbarVars.horizontalScrollbarThumb && !scrollbarVars.isDraggingHorizontalThumb) {
            scrollbarVars.horizontalScrollbarThumb.fill(staticParams.scrollbarThumbBackground)
            setPointerStyle(stageVars.stage, false, 'grab')
        }
        // scrollbarVars.scrollbarLayer?.batchDraw()
    })
}

/**
 * 创建水平滚动条
 * @returns {void}
 */
export const drawHorizontalScrollbar = () => {
    if (!stageVars.stage || !scrollbarVars.scrollbarLayer) return
    const { width: stageWidth, height: stageHeight } = getStageAttr()
    const { maxScrollX, maxScrollY } = getScrollLimits()

    const verticalScrollbarSpaceForHorizontal = maxScrollY > 0 ? staticParams.scrollbarSize : 0
    // 绘制水平滚动条轨道
    createUnifiedCellRect({
        name: 'horizontal-scrollbar-track',
        x: 0,
        y: stageHeight - staticParams.scrollbarSize,
        width: stageWidth - verticalScrollbarSpaceForHorizontal,
        height: staticParams.scrollbarSize,
        fill: staticParams.scrollbarBackground,
        stroke: staticParams.borderColor,
        strokeWidth: 1,
        listening: false,
        group: scrollbarVars.horizontalScrollbarGroup!
    })

    // 计算水平滚动条宽度
    const { leftWidth, rightWidth, centerWidth } = getSplitColumns()
    const verticalScrollbarSpaceForThumb = maxScrollY > 0 ? staticParams.scrollbarSize : 0
    // 计算水平滚动条宽度
    const visibleWidth = stageWidth - leftWidth - rightWidth - verticalScrollbarSpaceForThumb
    const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / centerWidth)
    const thumbX = leftWidth + (scrollbarVars.stageScrollX / maxScrollX) * (visibleWidth - thumbWidth)

    // 绘制水平滚动条滑块
    scrollbarVars.horizontalScrollbarThumb = createUnifiedCellRect({
        name: 'horizontal-scrollbar-thumb',
        x: thumbX,
        y: stageHeight - staticParams.scrollbarSize + 2,
        width: thumbWidth,
        height: staticParams.scrollbarSize - 4,
        fill: staticParams.scrollbarThumbBackground,
        cornerRadius: 2,
        listening: true,
        stroke: staticParams.borderColor,
        strokeWidth: 0,
        group: scrollbarVars.horizontalScrollbarGroup!
    })

    // 设置水平滚动条事件
    setupHorizontalScrollbarEvents()
}

/**
 * 处理滚轮事件
 * @param {WheelEvent} e - 滚轮事件
 */
const handleMouseWheel = (e: WheelEvent) => {
    e.preventDefault()

    if (stageVars.stage) stageVars.stage.setPointersPositions(e)

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
export const initWheelListener = () => {
    const tableContainer = getTableContainer()
    tableContainer?.addEventListener('wheel', handleMouseWheel, { passive: false })
}

/**
 * 清理滚轮事件监听器
 * @returns {void}
 */
export const cleanupWheelListener = () => {
    const tableContainer = getTableContainer()
    tableContainer?.removeEventListener('wheel', handleMouseWheel)
}
