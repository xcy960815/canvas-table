import Konva from 'konva'
import { staticParams, tableData } from "./parameter"
import { clearPool, constrainToRange, getTableContainer, setPointerStyle, createGroup } from './utils'
import { createHeaderCenterGroup, createHeaderLeftGroup, createHeaderRightGroup, createHeaderClipGroup, drawHeaderPart, headerVars } from './header-handler'

import { bodyVars, calculateVisibleRows, getScrollLimits, getColumnsInfo, createBodyLeftGroup, createBodyCenterGroup, createBodyRightGroup, createLeftBodyClipGroup, createCenterBodyClipGroup, createRightBodyClipGroup, drawBodyPart, getSummaryRowHeight } from './body-handler'
import { summaryVars, createSummaryLeftGroup, createSummaryCenterGroup, createSummaryRightGroup, createSummaryClipGroup, drawSummaryPart } from './summary-handler'
import { drawHorizontalScrollbarPart, drawVerticalScrollbarPart, scrollbarVars, updateScrollPositions } from './scrollbar-handler'


interface StageVars {
    stage: Konva.Stage | null,
}


export const stageVars: StageVars = {
    /**
     * Stage 实例
     */
    stage: null,
}


/**
 * 获取 Stage 的属性
 * @returns {Object} Stage 属性对象
 */
export const getStageAttr = () => {
    if (!stageVars.stage) return { width: 0, height: 0 }
    return {
        width: stageVars.stage.width(),
        height: stageVars.stage.height()
    }
}

/**
 * 清除分组 清理所有分组
 * @returns {void}
 */
export const clearGroups = () => {
    // 表头相关
    headerVars.headerLayer?.destroyChildren()

    // 主体相关
    bodyVars.bodyLayer?.destroyChildren()
    bodyVars.fixedBodyLayer?.destroyChildren()

    // 汇总相关
    summaryVars.summaryLayer?.destroyChildren()

    // ========== 滚动条相关 ==========
    scrollbarVars.scrollbarLayer?.destroyChildren()
    scrollbarVars.scrollbarLayer?.destroyChildren()
    scrollbarVars.verticalScrollbarGroup = null
    scrollbarVars.horizontalScrollbarGroup = null
    scrollbarVars.verticalScrollbarThumb = null
    scrollbarVars.horizontalScrollbarThumb = null
    // 清理 Body 对象池
    clearPool(bodyVars.leftBodyPools.cellRects)
    clearPool(bodyVars.leftBodyPools.cellTexts)
    clearPool(bodyVars.centerBodyPools.cellRects)
    clearPool(bodyVars.centerBodyPools.cellTexts)
    clearPool(bodyVars.rightBodyPools.cellRects)
    clearPool(bodyVars.rightBodyPools.cellTexts)

    /**
     * 重置单元格选择
     * @returns {void}
     */
    bodyVars.highlightRect = null

    /**
     * 重置虚拟滚动状态
     * @returns {void}
     */
    bodyVars.visibleRowStart = 0
    bodyVars.visibleRowEnd = 0
    bodyVars.visibleRowCount = 0

    /**
     * 重置汇总组引用
     * @returns {void}
     */
    summaryVars.leftSummaryGroup = null
    summaryVars.centerSummaryGroup = null
    summaryVars.rightSummaryGroup = null
}


/**
 * 初始化 Stage 和所有 Layer
 * @returns {void}
 */
export const initStage = () => {
    const tableContainer = getTableContainer()
    if (!tableContainer) return
    const width = tableContainer.clientWidth
    const height = tableContainer.clientHeight

    if (!stageVars.stage) {
        stageVars.stage = new Konva.Stage({ container: tableContainer, width, height })
    } else {
        stageVars.stage.size({ width, height })
    }

    // 主体相关
    // 1. 主体内容层（最底层 - 可滚动的body部分）
    if (!bodyVars.bodyLayer) {
        bodyVars.bodyLayer = new Konva.Layer()
        stageVars.stage.add(bodyVars.bodyLayer)
    }

    // 2. 固定列body层（中间层 - 左右固定列的body部分）
    if (!bodyVars.fixedBodyLayer) {
        bodyVars.fixedBodyLayer = new Konva.Layer()
        stageVars.stage.add(bodyVars.fixedBodyLayer)
    }

    // 3. 表头层（高层 - 所有表头，不被遮挡）
    if (!headerVars.headerLayer) {
        headerVars.headerLayer = new Konva.Layer()
        stageVars.stage.add(headerVars.headerLayer)
    }

    // 4. 滚动条层（最高层）
    if (!scrollbarVars.scrollbarLayer) {
        scrollbarVars.scrollbarLayer = new Konva.Layer()
        stageVars.stage.add(scrollbarVars.scrollbarLayer)
    }

    // ========== 滚动条相关 ==========

    // 5. 滚动条组（根据滚动需求创建）
    const { maxScrollX, maxScrollY } = getScrollLimits()

    if (maxScrollY > 0 && !scrollbarVars.verticalScrollbarGroup) {
        scrollbarVars.verticalScrollbarGroup = new Konva.Group()
        scrollbarVars.scrollbarLayer.add(scrollbarVars.verticalScrollbarGroup)
    }

    if (maxScrollX > 0 && !scrollbarVars.horizontalScrollbarGroup) {
        scrollbarVars.horizontalScrollbarGroup = new Konva.Group()
        scrollbarVars.scrollbarLayer.add(scrollbarVars.horizontalScrollbarGroup)
    }

    // 汇总层
    if (!summaryVars.summaryLayer) {
        summaryVars.summaryLayer = new Konva.Layer()
        stageVars.stage.add(summaryVars.summaryLayer)
    }

    stageVars.stage.setPointersPositions({
        clientX: 0,
        clientY: 0
    })

}

/**
 * 清理所有 Stage 相关资源
 * @returns {void}
 */
export const destroyStage = () => {

    stageVars.stage?.destroy()

    stageVars.stage = null
    // 表头相关
    headerVars.headerLayer = null

    // 主体相关
    bodyVars.bodyLayer = null
    bodyVars.fixedBodyLayer = null

    // 汇总相关
    summaryVars.summaryLayer = null

    // ========== 滚动条相关 ==========
    scrollbarVars.scrollbarLayer = null
    scrollbarVars.verticalScrollbarGroup = null
    scrollbarVars.horizontalScrollbarGroup = null
    scrollbarVars.verticalScrollbarThumb = null
    scrollbarVars.horizontalScrollbarThumb = null

    // 其他
    bodyVars.highlightRect = null
}

/**
 * 刷新表格（可选重置滚动位置）
 * @param {boolean} resetScroll - 是否重置滚动位置
 */
export const refreshTable = (resetScroll: boolean) => {
    if (resetScroll) {
        scrollbarVars.stageScrollX = 0
        scrollbarVars.stageScrollY = 0
    } else {
        const { maxScrollX, maxScrollY } = getScrollLimits()
        scrollbarVars.stageScrollX = constrainToRange(scrollbarVars.stageScrollX, 0, maxScrollX)
        scrollbarVars.stageScrollY = constrainToRange(scrollbarVars.stageScrollY, 0, maxScrollY)
    }
    clearGroups()
    rebuildGroups()
}

/**
 * 重建表头分组
 * @returns {void}
 */
const rebuildHeaderGroups = () => {
    if (!headerVars.headerLayer) return
    const { width: stageWidth, } = getStageAttr()
    const { maxScrollY } = getScrollLimits()
    const verticalScrollbarWidth = maxScrollY > 0 ? staticParams.scrollbarSize : 0
    const { leftCols, centerCols, rightCols, leftWidth, rightWidth } = getColumnsInfo()
    // 为中间表头也创建裁剪组，防止表头横向滚动时遮挡固定列
    const headerClipGroup = createHeaderClipGroup(0, 0, {
        x: 0,
        y: 0,
        width: stageWidth - rightWidth - verticalScrollbarWidth,
        height: staticParams.headerRowHeight
    })

    headerVars.headerLayer.add(headerClipGroup)

    headerVars.leftHeaderGroup = createHeaderLeftGroup(0, 0)
    headerVars.centerHeaderGroup = createHeaderCenterGroup(leftWidth, 0)
    headerVars.rightHeaderGroup = createHeaderRightGroup(stageWidth - rightWidth - verticalScrollbarWidth, 0)
    headerClipGroup.add(headerVars.centerHeaderGroup)

    headerVars.headerLayer.add(headerVars.leftHeaderGroup, headerVars.rightHeaderGroup) // 固定表头必须在表头层，确保不被body层遮挡

    // 绘制表头
    drawHeaderPart(headerVars.leftHeaderGroup, leftCols)
    drawHeaderPart(headerVars.centerHeaderGroup, centerCols)
    drawHeaderPart(headerVars.rightHeaderGroup, rightCols)
}

/**
 * 重建主体分组
 * @returns {void}
 */
const rebuildBodyGroups = () => {
    if (!bodyVars.bodyLayer || !bodyVars.fixedBodyLayer) return
    const { leftCols, centerCols, rightCols, leftWidth, rightWidth } = getColumnsInfo()
    const { width: stageWidth, height: stageHeight } = getStageAttr()
    const { maxScrollX, maxScrollY } = getScrollLimits()
    const verticalScrollbarWidth = maxScrollY > 0 ? staticParams.scrollbarSize : 0
    const horizontalScrollbarHeight = maxScrollX > 0 ? staticParams.scrollbarSize : 0
    // 为中间可滚动区域创建裁剪组，防止遮挡固定列
    const bodyClipGroupHeight = stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - horizontalScrollbarHeight
    const bodyClipGroupWidth = stageWidth - leftWidth - rightWidth - verticalScrollbarWidth
    const centerBodyClipGroup = createCenterBodyClipGroup(leftWidth, staticParams.headerRowHeight, {
        x: 0,
        y: 0,
        width: bodyClipGroupWidth,
        height: bodyClipGroupHeight
    })

    bodyVars.bodyLayer.add(centerBodyClipGroup)

    bodyVars.leftBodyGroup = createBodyLeftGroup(0, 0) // 现在相对于裁剪组，初始位置为0
    bodyVars.centerBodyGroup = createBodyCenterGroup(-scrollbarVars.stageScrollX, -scrollbarVars.stageScrollY)
    bodyVars.rightBodyGroup = createBodyRightGroup(0, 0) // 现在相对于裁剪组，初始位置为0

    centerBodyClipGroup.add(bodyVars.centerBodyGroup)

    const leftBodyClipGroup = createLeftBodyClipGroup(0, staticParams.headerRowHeight, {
        x: 0,
        y: 0,
        width: leftWidth,
        height: bodyClipGroupHeight
    })

    const rightBodyClipGroup = createRightBodyClipGroup(
        stageWidth - rightWidth - verticalScrollbarWidth,
        staticParams.headerRowHeight,
        {
            x: 0,
            y: 0,
            width: rightWidth,
            height: bodyClipGroupHeight
        }
    )

    leftBodyClipGroup.add(bodyVars.leftBodyGroup)
    rightBodyClipGroup.add(bodyVars.rightBodyGroup)

    // 调整左右body组的位置，使其相对于裁剪组
    bodyVars.leftBodyGroup.x(0)
    bodyVars.leftBodyGroup.y(-scrollbarVars.stageScrollY)
    bodyVars.rightBodyGroup.x(0)
    bodyVars.rightBodyGroup.y(-scrollbarVars.stageScrollY)

    bodyVars.fixedBodyLayer.add(leftBodyClipGroup, rightBodyClipGroup) // 添加裁剪组到固定层

    // 主体相关 - 绘制所有主体部分
    drawBodyPart(bodyVars.leftBodyGroup, leftCols, bodyVars.leftBodyPools)
    drawBodyPart(bodyVars.centerBodyGroup, centerCols, bodyVars.centerBodyPools)
    drawBodyPart(bodyVars.rightBodyGroup, rightCols, bodyVars.rightBodyPools)

}


/**
 * 重建汇总分组
 * @returns {void}
 */
const rebuildSummaryGroups = () => {
    if (!summaryVars.summaryLayer) return

    // 创建汇总行组（完全参考header的实现方式）
    if (staticParams.enableSummary) {
        const { leftCols, centerCols, rightCols, leftWidth, rightWidth } = getColumnsInfo()
        const { width: stageWidth, height: stageHeight } = getStageAttr()
        const { maxScrollX, maxScrollY } = getScrollLimits()
        const verticalScrollbarWidth = maxScrollY > 0 ? staticParams.scrollbarSize : 0
        const horizontalScrollbarHeight = maxScrollX > 0 ? staticParams.scrollbarSize : 0
        const y = stageHeight - getSummaryRowHeight() - horizontalScrollbarHeight
        const centerSummaryClipGroup = createSummaryClipGroup(0, y, {
            x: 0,
            y: 0,
            width: stageWidth - rightWidth - verticalScrollbarWidth,
            height: getSummaryRowHeight()
        })

        summaryVars.summaryLayer.add(centerSummaryClipGroup)

        summaryVars.leftSummaryGroup = createSummaryLeftGroup(0, y) // 直接定位到汇总行位置
        summaryVars.centerSummaryGroup = createSummaryCenterGroup(leftWidth, 0)
        summaryVars.rightSummaryGroup = createSummaryRightGroup(stageWidth - rightWidth - verticalScrollbarWidth, y)

        centerSummaryClipGroup.add(summaryVars.centerSummaryGroup)
        summaryVars.summaryLayer.add(summaryVars.leftSummaryGroup, summaryVars.rightSummaryGroup)

        drawSummaryPart(summaryVars.leftSummaryGroup, leftCols)
        drawSummaryPart(summaryVars.centerSummaryGroup, centerCols)
        drawSummaryPart(summaryVars.rightSummaryGroup, rightCols)
    } else {
        summaryVars.leftSummaryGroup = null
        summaryVars.centerSummaryGroup = null
        summaryVars.rightSummaryGroup = null
    }
}

/**
 * 重建所有分组
 * @returns {void}
 */
export const rebuildGroups = () => {
    if (
        !stageVars.stage ||


        !scrollbarVars.scrollbarLayer
    ) {
        return
    }
    rebuildHeaderGroups()
    rebuildBodyGroups()
    rebuildSummaryGroups()
    const { maxScrollX, maxScrollY } = getScrollLimits()

    // 滚动条相关 - 绘制滚动条
    if (maxScrollY > 0) {
        scrollbarVars.verticalScrollbarGroup = new Konva.Group()
        scrollbarVars.scrollbarLayer.add(scrollbarVars.verticalScrollbarGroup)
        drawVerticalScrollbarPart()
    }

    if (maxScrollX > 0) {
        scrollbarVars.horizontalScrollbarGroup = new Konva.Group()
        scrollbarVars.scrollbarLayer.add(scrollbarVars.horizontalScrollbarGroup)
        drawHorizontalScrollbarPart()
    }

    // 主体相关
    bodyVars.bodyLayer?.batchDraw() // 1. 先绘制可滚动的中间内容

    bodyVars.fixedBodyLayer?.batchDraw() // 2. 再绘制固定列（覆盖在上面）

    // 表头相关
    headerVars.headerLayer?.batchDraw() // 3. 表头在最上层

    // 汇总相关
    summaryVars.summaryLayer?.batchDraw() // 4. 汇总层（像header一样统一管理）

    // 滚动条相关
    scrollbarVars.scrollbarLayer?.batchDraw() // 5. 滚动条在最顶层
}


/**
 * 全局鼠标移动处理
 * @param {MouseEvent} mouseEvent - 鼠标事件
 */
export const handleGlobalMouseMove = (mouseEvent: MouseEvent) => {
    if (!stageVars.stage) return
    stageVars.stage.setPointersPositions(mouseEvent)

    // 手动拖拽导致的垂直滚动
    if (scrollbarVars.isDraggingVerticalThumb) {
        const deltaY = mouseEvent.clientY - scrollbarVars.dragStartY
        const { maxScrollY, maxScrollX } = getScrollLimits()
        const { height: stageHeight } = getStageAttr()
        const trackHeight =
            stageHeight -
            staticParams.headerRowHeight -
            (staticParams.enableSummary ? staticParams.summaryRowHeight : 0) -
            (maxScrollX > 0 ? staticParams.scrollbarSize : 0)
        const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * staticParams.bodyRowHeight))
        const scrollRatio = deltaY / (trackHeight - thumbHeight)
        const newScrollY = scrollbarVars.dragStartScrollY + scrollRatio * maxScrollY

        const oldScrollY = scrollbarVars.stageScrollY
        scrollbarVars.stageScrollY = constrainToRange(newScrollY, 0, maxScrollY)

        // 检查是否需要重新渲染虚拟滚动内容
        const oldVisibleStart = bodyVars.visibleRowStart
        const oldVisibleEnd = bodyVars.visibleRowEnd
        calculateVisibleRows()

        const needsRerender =
            bodyVars.visibleRowStart !== oldVisibleStart ||
            bodyVars.visibleRowEnd !== oldVisibleEnd ||
            Math.abs(scrollbarVars.stageScrollY - oldScrollY) > staticParams.bodyRowHeight * 5

        if (needsRerender) {
            const { leftCols, centerCols, rightCols } = getColumnsInfo()
            // 主体相关 - 重新绘制所有主体部分
            drawBodyPart(bodyVars.leftBodyGroup, leftCols, bodyVars.leftBodyPools)
            drawBodyPart(bodyVars.centerBodyGroup, centerCols, bodyVars.centerBodyPools)
            drawBodyPart(bodyVars.rightBodyGroup, rightCols, bodyVars.rightBodyPools)
        }

        updateScrollPositions()
        return
    }

    // 手动拖拽导致的水平滚动
    if (scrollbarVars.isDraggingHorizontalThumb) {
        const deltaX = mouseEvent.clientX - scrollbarVars.dragStartX
        const { maxScrollX } = getScrollLimits()
        const { leftWidth, rightWidth, centerWidth } = getColumnsInfo()
        const { width: stageWidth } = getStageAttr()
        const visibleWidth = stageWidth - leftWidth - rightWidth - staticParams.scrollbarSize
        const thumbWidth = Math.max(20, (visibleWidth * visibleWidth) / centerWidth)
        const scrollRatio = deltaX / (visibleWidth - thumbWidth)
        const newScrollX = scrollbarVars.dragStartScrollX + scrollRatio * maxScrollX

        scrollbarVars.stageScrollX = constrainToRange(newScrollX, 0, maxScrollX)
        updateScrollPositions()
        return
    }
}

/**
 * 全局鼠标抬起处理
 * @param {MouseEvent} mouseEvent - 鼠标事件
 */
export const handleGlobalMouseUp = (mouseEvent: MouseEvent) => {
    if (stageVars.stage) stageVars.stage.setPointersPositions(mouseEvent)
    // 滚动条拖拽结束
    if (scrollbarVars.isDraggingVerticalThumb || scrollbarVars.isDraggingHorizontalThumb) {
        scrollbarVars.isDraggingVerticalThumb = false
        scrollbarVars.isDraggingHorizontalThumb = false
        setPointerStyle(stageVars.stage, false, 'default')
        if (scrollbarVars.verticalScrollbarThumb && !scrollbarVars.isDraggingVerticalThumb)
            scrollbarVars.verticalScrollbarThumb.fill(staticParams.scrollbarThumbBackground)
        if (scrollbarVars.horizontalScrollbarThumb && !scrollbarVars.isDraggingHorizontalThumb)
            scrollbarVars.horizontalScrollbarThumb.fill(staticParams.scrollbarThumbBackground)
        scrollbarVars.scrollbarLayer?.batchDraw()
    }
}

/**
 * 全局窗口尺寸变化处理
 * @returns {void}
 */
const handleGlobalResize = () => {
    initStage()
    clearGroups()
    rebuildGroups()
}

/**
 * 初始化全局事件监听器
 * @returns {void}
 */
export const initStageListeners = () => {
    window.addEventListener('resize', handleGlobalResize)
    // 需要保留鼠标移动监听以支持列宽拖拽功能
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
}


/**
 * 清理全局事件监听器
 * @returns {void}
 */
export const cleanupStageListeners = () => {
    window.removeEventListener('resize', handleGlobalResize)
    // 清理鼠标移动监听
    window.removeEventListener('mousemove', handleGlobalMouseMove)
    window.removeEventListener('mouseup', handleGlobalMouseUp)
}
