import Konva from 'konva'
import { staticParams } from "./parameter"
import { clearPool, constrainToRange, getTableContainer,createGroup, setPointerStyle } from './utils'
import { createHeaderCenterGroups, createHeaderLeftGroups, createHeaderRightGroups, drawHeaderPart, headerVars } from './header-handler'
import { bodyVars, calculateVisibleRows, getScrollLimits, getSplitColumns,createBodyCenterGroups,createBodyLeftGroups,createBodyRightGroups,drawBodyPart,getSummaryRowHeight } from './body-handler'
import { summaryVars,createSummaryLeftGroups,createSummaryCenterGroups,createSummaryRightGroups,drawSummaryPart } from './summary-handler'
import { drawHorizontalScrollbar, drawVerticalScrollbar, scrollbarVars, updateScrollPositions } from './scrollbar-handler'
import { tableData } from './parameter'

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

    calculateVisibleRows()
    clearGroups()
    rebuildGroups()
}



/**
 * 重建分组
 * @returns {void}
 */
export const rebuildGroups = () => {
    if (
        !stageVars.stage ||
        !headerVars.headerLayer ||
        !bodyVars.bodyLayer ||
        !bodyVars.fixedBodyLayer ||
        !summaryVars.summaryLayer ||
        !scrollbarVars.scrollbarLayer
    ) {
        return
    }

    const { leftCols, centerCols, rightCols, leftWidth, centerWidth, rightWidth } = getSplitColumns()
    const { width: stageWidth, height: stageHeight } = getStageAttr()
    const { maxScrollX, maxScrollY } = getScrollLimits()
    const verticalScrollbarWidth = maxScrollY > 0 ? staticParams.scrollbarSize : 0
    const horizontalScrollbarHeight = maxScrollX > 0 ? staticParams.scrollbarSize : 0
    
    
    // 为中间表头也创建裁剪组，防止表头横向滚动时遮挡固定列
    const centerHeaderClipGroup = createGroup('header', 'center', 0, 0, {
        x: 0,
        y: 0,
        width: stageWidth - rightWidth - verticalScrollbarWidth,
        height: staticParams.headerRowHeight
    })

    headerVars.headerLayer.add(centerHeaderClipGroup)

    headerVars.leftHeaderGroup = createHeaderLeftGroups(0, 0)
    headerVars.centerHeaderGroup = createHeaderCenterGroups(leftWidth, 0)
    headerVars.rightHeaderGroup = createHeaderRightGroups(stageWidth - rightWidth - verticalScrollbarWidth, 0)
    centerHeaderClipGroup.add(headerVars.centerHeaderGroup)

    headerVars.headerLayer.add(headerVars.leftHeaderGroup, headerVars.rightHeaderGroup) // 固定表头必须在表头层，确保不被body层遮挡

    // 绘制表头
    drawHeaderPart(headerVars.leftHeaderGroup, leftCols)
    drawHeaderPart(headerVars.centerHeaderGroup, centerCols)
    drawHeaderPart(headerVars.rightHeaderGroup, rightCols)

    // 为中间可滚动区域创建裁剪组，防止遮挡固定列
    const bodyClipGroupHeight = stageHeight - staticParams.headerRowHeight - getSummaryRowHeight() - horizontalScrollbarHeight
    const bodyClipGroupWidth = stageWidth - leftWidth - rightWidth - verticalScrollbarWidth
    const centerBodyClipGroup = createGroup('body', 'center', leftWidth, staticParams.headerRowHeight, {
        x: 0,
        y: 0,
        width: bodyClipGroupWidth,
        height: bodyClipGroupHeight
    })

    bodyVars.bodyLayer.add(centerBodyClipGroup)

    bodyVars.leftBodyGroup = createBodyLeftGroups(0, 0) // 现在相对于裁剪组，初始位置为0
    bodyVars.centerBodyGroup = createBodyCenterGroups(-scrollbarVars.stageScrollX, -scrollbarVars.stageScrollY)
    bodyVars.rightBodyGroup = createBodyRightGroups(0, 0) // 现在相对于裁剪组，初始位置为0

    centerBodyClipGroup.add(bodyVars.centerBodyGroup)

    const leftBodyClipGroup = createGroup('body', 'left', 0, staticParams.headerRowHeight, {
        x: 0,
        y: 0,
        width: leftWidth,
        height: bodyClipGroupHeight
    })

    const rightBodyClipGroup = createGroup(
        'body',
        'right',
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

    // 创建汇总行组（完全参考header的实现方式）
    if (staticParams.enableSummary) {
        const y = stageHeight - getSummaryRowHeight() - horizontalScrollbarHeight

        // 为中间汇总也创建裁剪组，防止汇总横向滚动时遮挡固定列（与表头保持一致）
        const centerSummaryClipGroup = createGroup('summary', 'center', 0, y, {
            x: 0,
            y: 0,
            width: stageWidth - rightWidth - verticalScrollbarWidth,
            height: getSummaryRowHeight()
        })

        summaryVars.summaryLayer.add(centerSummaryClipGroup)

        summaryVars.leftSummaryGroup = createSummaryLeftGroups(0, y) // 直接定位到汇总行位置
        summaryVars.centerSummaryGroup = createSummaryCenterGroups(leftWidth, 0)
        summaryVars.rightSummaryGroup = createSummaryRightGroups(stageWidth - rightWidth - verticalScrollbarWidth, y)

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

    // 滚动条相关 - 绘制滚动条
    if (maxScrollY > 0) {
        scrollbarVars.verticalScrollbarGroup = new Konva.Group()
        scrollbarVars.scrollbarLayer.add(scrollbarVars.verticalScrollbarGroup)
        drawVerticalScrollbar()
    }

    if (maxScrollX > 0) {
        scrollbarVars.horizontalScrollbarGroup = new Konva.Group()
        scrollbarVars.scrollbarLayer.add(scrollbarVars.horizontalScrollbarGroup)
        drawHorizontalScrollbar()
    }

    // 确保层级绘制顺序正确：固定列在上层
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
        const stageHeight = stageVars.stage.height()
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
            const { leftCols, centerCols, rightCols } = getSplitColumns()
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
        const { leftWidth, rightWidth, centerWidth } = getSplitColumns()
        const stageWidth = stageVars.stage.width()
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
