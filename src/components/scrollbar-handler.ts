import Konva from "konva";
import { stageVars, getStageSize, scheduleLayersBatchDraw } from "./stage-handler";
import { staticParams, tableData } from "./parameter";
import { headerVars } from "./header-handler";
import { bodyVars, calculateVisibleRows, columnsInfo, drawBodyPart } from "./body-handler";
import { summaryVars, getSummaryRowHeight } from "./summary-handler";
import {
    getTableContainer,
    setPointerStyle,
    constrainToRange,
    drawUnifiedRect,
    createGroup,
} from './utils'

interface ScrollbarVars {
    /**
     * 滚动条层（滚动条）
     */
    scrollbarLayer: Konva.Layer | null,
    /**
     * 垂直滚动条组
     */
    verticalScrollbarGroup: Konva.Group | null,
    /**
     * 水平滚动条组
     */
    horizontalScrollbarGroup: Konva.Group | null,
    /**
     * 垂直滚动条滑块
     */
    verticalScrollbarThumb: Konva.Rect | null,
    /**
     * 水平滚动条滑块
     */
    horizontalScrollbarThumb: Konva.Rect | null,
    /**
     * 是否正在垂直拖动滚动条
     */
    isDraggingVerticalThumb: boolean
    /**
     * 是否正在水平拖动滚动条
     */
    isDraggingHorizontalThumb: boolean
    /**
     * 垂直滚动条拖拽起始 Y 坐标
     */
    dragStartY: number
    /**
     * 水平滚动条拖拽起始 X 坐标
     */
    dragStartX: number
    /**
     * 垂直滚动条拖拽起始滚动位置 Y
     */
    stageScrollY: number
    /**
     * 水平滚动条拖拽起始滚动位置 X
     */
    stageScrollX: number
    /**
     * 垂直滚动条拖拽起始滚动位置 Y
     */
    dragStartScrollY: number
    /**
     * 水平滚动条拖拽起始滚动位置 X
     */
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
 * 创建垂直滚动条组
 * @returns {Konva.Group} 垂直滚动条组
 */
export const createVerticalScrollbarGroup = (): Konva.Group => createGroup('scrollbar', 'vertical')

/**
 * 创建水平滚动条组
 * @returns {Konva.Group} 水平滚动条组
 */
export const createHorizontalScrollbarGroup = (): Konva.Group => createGroup('scrollbar', 'horizontal')

/**
 * 计算滚动范围
 * @returns {Object} 包含最大滚动偏移量的对象
 */
export const calculateScrollRange = () => {
    if (!stageVars.stage) return { maxHorizontalScroll: 0, maxVerticalScroll: 0 }

    const { width: stageWidth, height: stageHeight } = getStageSize()

    // 计算内容高度
    const contentHeight = tableData.value.length * staticParams.bodyRowHeight

    // 初步估算：不预留滚动条空间
    const visibleContentWidthNoV = stageWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth
    const contentHeightNoH = stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight
    const prelimMaxX = Math.max(0, columnsInfo.totalWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth - visibleContentWidthNoV)
    const prelimMaxY = Math.max(0, contentHeight - contentHeightNoH)
    const verticalScrollbarSpace = prelimMaxY > 0 ? staticParams.scrollbarSize : 0
    const horizontalScrollbarSpace = prelimMaxX > 0 ? staticParams.scrollbarSize : 0
    // 复算：考虑另一条滚动条占位
    const visibleContentWidth = stageWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth - verticalScrollbarSpace
    const maxHorizontalScroll = Math.max(0, columnsInfo.totalWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth - visibleContentWidth)
    const maxVerticalScroll = Math.max(
        0,
        contentHeight - (stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight - horizontalScrollbarSpace)
    )

    return { maxHorizontalScroll, maxVerticalScroll }
}


/**
 * 更新滚动位置
 * @returns {void}
 */
export const updateScrollPositions = () => {
    if (
        !stageVars.stage ||
        !bodyVars.leftBodyGroup ||
        !bodyVars.centerBodyGroup ||
        !bodyVars.rightBodyGroup ||
        !headerVars.centerHeaderGroup
    ) return

    // 预计算常用值
    const scrollY = -scrollbarVars.stageScrollY
    const centerX = -scrollbarVars.stageScrollX
    const headerX = columnsInfo.leftPartWidth - scrollbarVars.stageScrollX

    // 批量更新位置 - 减少函数调用
    bodyVars.leftBodyGroup.y(scrollY)
    bodyVars.rightBodyGroup.y(scrollY)
    bodyVars.centerBodyGroup.setAttrs({ x: centerX, y: scrollY })
    headerVars.centerHeaderGroup.x(headerX)

    // 更新汇总组位置
    if (summaryVars.centerSummaryGroup) {
        summaryVars.centerSummaryGroup.setAttrs({ x: headerX, y: 0 })
    }

    // 滚动条更新 - 只在必要时计算
    const { width: stageWidth, height: stageHeight } = getStageSize()
    const { maxHorizontalScroll, maxVerticalScroll } = calculateScrollRange()

    // 批量更新滚动条位置
    let needsScrollbarRedraw = false

    if (scrollbarVars.verticalScrollbarThumb && maxVerticalScroll > 0) {
        const trackHeight = stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight -
            (maxHorizontalScroll > 0 ? staticParams.scrollbarSize : 0)
        const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * staticParams.bodyRowHeight))
        const thumbY = staticParams.headerRowHeight + (scrollbarVars.stageScrollY / maxVerticalScroll) * (trackHeight - thumbHeight)

        scrollbarVars.verticalScrollbarThumb.y(thumbY)
        needsScrollbarRedraw = true
    }

    if (scrollbarVars.horizontalScrollbarThumb && maxHorizontalScroll > 0) {
        const visibleWidth = stageWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth -
            (maxVerticalScroll > 0 ? staticParams.scrollbarSize : 0)
        const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / columnsInfo.centerPartWidth)
        const thumbX = columnsInfo.leftPartWidth + (scrollbarVars.stageScrollX / maxHorizontalScroll) * (visibleWidth - thumbWidth)

        scrollbarVars.horizontalScrollbarThumb.x(thumbX)
        needsScrollbarRedraw = true
    }

    // 批量重绘所有相关层（包含滚动条）
    scheduleLayersBatchDraw(['header', 'body', 'fixed', 'scrollbar', 'summary'])
}

/**
 * 更新水平滚动
 * @param {number} offsetX - 滚动偏移量
 */
export const updateHorizontalScroll = (offsetX: number) => {
    if (!stageVars.stage || !headerVars.centerHeaderGroup || !bodyVars.centerBodyGroup) return
    const { maxHorizontalScroll } = calculateScrollRange()
    scrollbarVars.stageScrollX = constrainToRange(scrollbarVars.stageScrollX + offsetX, 0, maxHorizontalScroll)
    const headerX = columnsInfo.leftPartWidth - scrollbarVars.stageScrollX
    const centerX = -scrollbarVars.stageScrollX

    // 主体相关 - 中间区域随横向滚动
    headerVars.centerHeaderGroup.x(headerX)
    bodyVars.centerBodyGroup?.x(centerX)
    summaryVars.centerSummaryGroup?.x(headerX) // 修复：汇总行应该和表头使用相同的X坐标（headerX）

    /* 更新滚动条位置 */
    if (stageVars.stage) {
        const { width: stageWidth, height: stageHeight } = getStageSize()
        const { maxHorizontalScroll: maxHScroll, maxVerticalScroll } = calculateScrollRange()

        // 更新水平滚动条位置
        if (scrollbarVars.horizontalScrollbarThumb && maxHScroll > 0) {
            const visibleWidth = stageWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth - (maxVerticalScroll > 0 ? staticParams.scrollbarSize : 0)
            const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / columnsInfo.centerPartWidth)
            const thumbX = columnsInfo.leftPartWidth + (scrollbarVars.stageScrollX / maxHScroll) * (visibleWidth - thumbWidth)
            scrollbarVars.horizontalScrollbarThumb.x(thumbX)
        }

    }

    // 水平滚动需要更新表头、主体、固定列和汇总行
    scheduleLayersBatchDraw(['header', 'body', 'fixed', 'scrollbar', 'summary'])
}


/**
 * 更新垂直滚动
 * @param {number} offsetY - 滚动偏移量
 */
export const updateVerticalScroll = (offsetY: number) => {
    if (!stageVars.stage || !bodyVars.leftBodyGroup || !bodyVars.centerBodyGroup || !bodyVars.rightBodyGroup) return

    const actualOffsetY = offsetY

    const { maxVerticalScroll } = calculateScrollRange()

    scrollbarVars.stageScrollY = constrainToRange(scrollbarVars.stageScrollY + actualOffsetY, 0, maxVerticalScroll)
    const oldVisibleStart = bodyVars.visibleRowStart

    const oldVisibleEnd = bodyVars.visibleRowEnd

    calculateVisibleRows()

    const visibleRangeChanged =
        bodyVars.visibleRowStart !== oldVisibleStart || bodyVars.visibleRowEnd !== oldVisibleEnd

    if (visibleRangeChanged) {
        // 重新渲染可视区域
        // 主体相关 - 批量执行重绘操作，减少单独的绘制调用
        const renderOperations = [
            () => drawBodyPart(bodyVars.leftBodyGroup, columnsInfo.leftColumns, bodyVars.leftBodyPools),
            () => drawBodyPart(bodyVars.centerBodyGroup, columnsInfo.centerColumns, bodyVars.centerBodyPools),
            () => drawBodyPart(bodyVars.rightBodyGroup, columnsInfo.rightColumns, bodyVars.rightBodyPools)
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

    /* 更新滚动条位置 */
    if (stageVars.stage) {
        const { width: stageWidth, height: stageHeight } = getStageSize()
        const { maxHorizontalScroll, maxVerticalScroll: maxVScroll } = calculateScrollRange()

        // 更新垂直滚动条位置
        if (scrollbarVars.verticalScrollbarThumb && maxVScroll > 0) {
            const trackHeight =
                stageHeight - staticParams.headerRowHeight - staticParams.summaryRowHeight - (maxHorizontalScroll > 0 ? staticParams.scrollbarSize : 0)
            const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * staticParams.bodyRowHeight))
            const thumbY = staticParams.headerRowHeight + (scrollbarVars.stageScrollY / maxVScroll) * (trackHeight - thumbHeight)
            scrollbarVars.verticalScrollbarThumb.y(thumbY)
        }

    }
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
 * 创建垂直滚动条
 * @returns {void}
 */
export const drawVerticalScrollbarPart = () => {

    if (!stageVars.stage || !scrollbarVars.scrollbarLayer) return

    const { width: stageWidth, height: stageHeight } = getStageSize()

    const { maxHorizontalScroll, maxVerticalScroll } = calculateScrollRange()

    // 绘制垂直滚动条顶部遮罩（覆盖表头部分）
    drawUnifiedRect({
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
        drawUnifiedRect({
            name: 'vertical-scrollbar-bottom-mask',
            x: stageWidth - staticParams.scrollbarSize,
            y: stageHeight - getSummaryRowHeight() - (maxHorizontalScroll > 0 ? staticParams.scrollbarSize : 0),
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
    drawUnifiedRect({
        name: 'vertical-scrollbar-track',
        x: stageWidth - staticParams.scrollbarSize,
        y: staticParams.headerRowHeight,
        width: staticParams.scrollbarSize,
        height: stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - (maxHorizontalScroll > 0 ? staticParams.scrollbarSize : 0),
        fill: staticParams.scrollbarBackground,
        stroke: staticParams.borderColor,
        strokeWidth: 1,
        listening: false,
        group: scrollbarVars.verticalScrollbarGroup!
    })

    // 计算垂直滚动条高度
    const trackHeight =
        stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - (maxHorizontalScroll > 0 ? staticParams.scrollbarSize : 0)
    const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * staticParams.bodyRowHeight))
    // 计算垂直滚动条 Y 坐标
    const thumbY = staticParams.headerRowHeight + (scrollbarVars.stageScrollY / maxVerticalScroll) * (trackHeight - thumbHeight)

    // 绘制垂直滚动条滑块
    scrollbarVars.verticalScrollbarThumb = drawUnifiedRect({
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
        // 记录开始位置
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
export const drawHorizontalScrollbarPart = () => {
    if (!stageVars.stage || !scrollbarVars.scrollbarLayer) return
    const { width: stageWidth, height: stageHeight } = getStageSize()
    const { maxHorizontalScroll, maxVerticalScroll } = calculateScrollRange()

    const verticalScrollbarSpaceForHorizontal = maxVerticalScroll > 0 ? staticParams.scrollbarSize : 0
    // 绘制水平滚动条轨道
    drawUnifiedRect({
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
    const verticalScrollbarSpaceForThumb = maxVerticalScroll > 0 ? staticParams.scrollbarSize : 0
    // 计算水平滚动条宽度
    const visibleWidth = stageWidth - columnsInfo.leftPartWidth - columnsInfo.rightPartWidth - verticalScrollbarSpaceForThumb
    const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / columnsInfo.centerPartWidth)
    const thumbX = columnsInfo.leftPartWidth + (scrollbarVars.stageScrollX / maxHorizontalScroll) * (visibleWidth - thumbWidth)

    // 绘制水平滚动条滑块
    scrollbarVars.horizontalScrollbarThumb = drawUnifiedRect({
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
