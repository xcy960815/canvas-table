<template>
  <div id="table-container" class="table-container" :style="tableContainerStyle"></div>
</template>
<script lang="ts" setup>
import { tableProps, staticParams, tableData, tableColumns } from './parameter';
import {
  getTableContainer,
  constrainToRange,
  setPointerStyle,
} from './utils'
import { onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { stageVars, initStage, destroyStage, clearGroups,rebuildGroups } from './stage-handler';
import { sortColumns, handleTableData } from './header-handler';
import { calculateVisibleRows, getScrollLimits, getSplitColumns, drawBodyPart } from "./body-handler";
import { bodyVars } from './body-handler';
import { scrollbarVars, updateScrollPositions, updateHorizontalScroll, updateVerticalScroll } from './scrollbar-handler';
import { refreshTable } from './stage-handler';

const props = defineProps(tableProps);

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
) => {
  const xAxisFields = staticParams.xAxisFields
  const yAxisFields = staticParams.yAxisFields
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
 * 全局鼠标移动处理
 * @param {MouseEvent} mouseEvent - 鼠标事件
 */
const handleGlobalMouseMove = (mouseEvent: MouseEvent) => {
  if (!stageVars.stage) return
  stageVars.stage.setPointersPositions(mouseEvent)

  // 手动拖拽导致的垂直滚动
  if (scrollbarVars.isDraggingVerticalThumb) {
    const deltaY = mouseEvent.clientY - scrollbarVars.dragStartY
    const { maxScrollY, maxScrollX } = getScrollLimits()
    const stageHeight = stageVars.stage.height()
    const trackHeight =
      stageHeight -
      props.headerRowHeight -
      (props.enableSummary ? props.summaryRowHeight : 0) - // 注释汇总高度
      (maxScrollX > 0 ? props.scrollbarSize : 0)
    const thumbHeight = Math.max(20, (trackHeight * trackHeight) / (tableData.value.length * props.bodyRowHeight))
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
      Math.abs(scrollbarVars.stageScrollY - oldScrollY) > props.bodyRowHeight * 5 // 配合更大的缓冲行数，减少重新渲染频率

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
    const visibleWidth = stageWidth - leftWidth - rightWidth - props.scrollbarSize
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
const handleGlobalMouseUp = (mouseEvent: MouseEvent) => {
  if (stageVars.stage) stageVars.stage.setPointersPositions(mouseEvent)

  // 滚动条拖拽结束
  if (scrollbarVars.isDraggingVerticalThumb || scrollbarVars.isDraggingHorizontalThumb) {
    scrollbarVars.isDraggingVerticalThumb = false
    scrollbarVars.isDraggingHorizontalThumb = false
    setPointerStyle(stageVars.stage, false, 'default')
    if (scrollbarVars.verticalScrollbarThumb && !scrollbarVars.isDraggingVerticalThumb)
      scrollbarVars.verticalScrollbarThumb.fill(props.scrollbarThumbBackground)
    if (scrollbarVars.horizontalScrollbarThumb && !scrollbarVars.isDraggingHorizontalThumb)
      scrollbarVars.horizontalScrollbarThumb.fill(props.scrollbarThumbBackground)
    scrollbarVars.scrollbarLayer?.batchDraw()
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


watch(props, () => {
  Object.entries(props).forEach(([key, value]) => {
    if (key in staticParams && value !== staticParams[key as keyof typeof staticParams]) {
      //  TODO: 这里需要优化，不能直接赋值，需要通过代理来实现 
      // @ts-ignore
      staticParams[key as keyof typeof staticParams] = value
    }
  })
}, {
  deep: true,
  immediate: true
})


/**
 * 监听 props 变化
 * @returns {void}
 */
watch(
  () => [props.xAxisFields, props.yAxisFields, props.data],
  () => {
    if (!stageVars.stage) return
    handleTableColumns()
    handleTableData()
    refreshTable(true)
  },
  {
    deep: true
  }
)

watch(
  () => [props.chartWidth, props.chartHeight],
  async () => {
    if (!stageVars.stage) return
    // 等待demo节点发生变更再触发该方法
    await nextTick()
    initStage()
    handleTableData()
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
    if (!stageVars.stage) return
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
    if (!stageVars.stage) return
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
    if (!stageVars.stage) return
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
    if (!stageVars.stage) return
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
    if (!stageVars.stage) return
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
    if (!stageVars.stage) return
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
    if (!stageVars.stage) return
    refreshTable(false)
  },
  {
    deep: true
  }
)



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
  handleTableColumns()
  initStage()
  handleTableData()
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