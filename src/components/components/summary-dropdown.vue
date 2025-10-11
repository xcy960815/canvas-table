<template>
  <teleport to="body">
    <div ref="summaryDropdownRef" v-show="summaryDropdown.visible" class="dms-summary-dropdown"
      :style="summaryDropdownStyle">
      <el-select v-model="summaryDropdown.selectedValue" size="small" placeholder="选择汇总" style="width: 160px"
        @change="handleSummaryChange" @blur="handleSummaryBlur" @keydown.stop>
        <el-option v-for="opt in summaryDropdown.options" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick, computed } from 'vue'
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { getDropdownPosition } from "../utils"
import { clearGroups,refreshTable } from "../stage-handler"
import { summaryState } from "../summary-handler"

const summaryDropdownRef = ref<HTMLElement | null>(null)

/**
 * 汇总下拉选中值变化
 * @param {string} value 选中值
 */
const handleSummaryChange = (value: string) => {
  const colName = summaryDropdown.colName
  const selected = summaryDropdown.selectedValue
  summaryState[colName] = selected
  refreshTable(false)
  // 选择后关闭弹框
  summaryDropdown.visible = false
}

const handleSummaryBlur = () => {

}

interface SummaryDropdownOption {
  label: string
  value: string
}

export interface SummaryDropdown {
  visible: boolean
  x: number
  y: number
  colName: string
  options: Array<SummaryDropdownOption>
  selectedValue: string
  originalClientX: number
  originalClientY: number
}


/**
 * 过滤下拉浮层样式
 */
const summaryDropdownStyle = computed(() => {
  return {
    position: 'fixed' as const,
    left: summaryDropdown.x + 'px',
    top: summaryDropdown.y + 'px',
    zIndex: 3000
  }
})


const summaryDropdown = reactive<SummaryDropdown>({
  visible: false,
  x: 0,
  y: 0,
  colName: '',
  options: [],
  selectedValue: '',
  // 存储原始点击位置，用于滚动时重新计算
  originalClientX: 0,
  originalClientY: 0
})

/**
 * 打开汇总下拉
 * @param {number} clientX 鼠标点击位置的 X 坐标
 * @param {number} clientY 鼠标点击位置的 Y 坐标
 * @param {string} colName 列名
 * @param {Array<{ label: string; value: string }>} options 选项列表
 * @param {string} selected 已选中的选项
 */
const openSummaryDropdown = (
  evt: KonvaEventObject<MouseEvent, Konva.Rect>,
  colName: string,
  options: Array<SummaryDropdownOption>,
  selected?: string
) => {
  // 存储原始点击位置（转换为页面坐标，考虑滚动偏移）
  const { clientX, clientY } = evt.evt
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft
  const scrollY = window.pageYOffset || document.documentElement.scrollTop
  summaryDropdown.originalClientX = clientX + scrollX
  summaryDropdown.originalClientY = clientY + scrollY
  summaryDropdown.visible = true
  nextTick(() => {
    if (!summaryDropdownRef.value) return
    const summaryDropdownEl = summaryDropdownRef.value
    if (!summaryDropdownEl) return
    const summaryDropdownElRect = summaryDropdownEl.getBoundingClientRect()
    const summaryDropdownElHeight = Math.ceil(summaryDropdownElRect.height)
    const summaryDropdownElWidth = Math.ceil(summaryDropdownElRect.width)
    const { dropdownX, dropdownY } = getDropdownPosition(
      clientX,
      clientY,
      summaryDropdownElWidth,
      summaryDropdownElHeight
    )
    summaryDropdown.x = dropdownX
    summaryDropdown.y = dropdownY
    summaryDropdown.colName = colName
    summaryDropdown.options = options
    summaryDropdown.selectedValue = selected || 'nodisplay'
  })
}

/**
 * 更新汇总下拉浮层位置
 */
const updateSummaryDropdownPositionsInTable = () => {
  // 本次开发先隐藏掉
  if (summaryDropdown.visible && summaryDropdownRef.value) {
    summaryDropdown.visible = false
  }
  // // 如果汇总下拉框可见，重新计算位置
  // if (summaryDropdown.visible && summaryDropdownRef.value) {
  //   const summaryDropdownElRect = summaryDropdownRef.value.getBoundingClientRect()
  //   const summaryDropdownElHeight = Math.ceil(summaryDropdownElRect.height)
  //   const summaryDropdownElWidth = Math.ceil(summaryDropdownElRect.width)

  //   // 对于表格内部滚动，使用保存的原始客户端坐标
  //   const { dropdownX, dropdownY } = getDropdownPosition(
  //     summaryDropdown.originalClientX,
  //     summaryDropdown.originalClientY,
  //     summaryDropdownElWidth,
  //     summaryDropdownElHeight
  //   )
  //   summaryDropdown.x = dropdownX
  //   summaryDropdown.y = dropdownY
  // }
}

/**
 * 关闭汇总下拉
 * @returns {void}
 */
const closeSummaryDropdown = () => {
  summaryDropdown.visible = false
}

/**
 *
 */
const updateSummaryDropdownPositionsInPage = () => {
  // 本次开发先隐藏掉
  if (summaryDropdown.visible && summaryDropdownRef.value) {
    summaryDropdown.visible = false
  }
  // // 如果汇总下拉框可见，重新计算位置
  // if (summaryDropdown.visible && summaryDropdownRef.value) {
  //   const summaryDropdownElRect = summaryDropdownRef.value.getBoundingClientRect()
  //   const summaryDropdownElHeight = Math.ceil(summaryDropdownElRect.height)
  //   const summaryDropdownElWidth = Math.ceil(summaryDropdownElRect.width)

  //   // 获取当前滚动偏移量
  //   const scrollX = window.pageXOffset || document.documentElement.scrollLeft
  //   const scrollY = window.pageYOffset || document.documentElement.scrollTop

  //   // 将保存的页面坐标转换为当前的视口坐标
  //   const currentClientX = summaryDropdown.originalClientX - scrollX
  //   const currentClientY = summaryDropdown.originalClientY - scrollY

  //   const { dropdownX, dropdownY } = getDropdownPosition(
  //     currentClientX,
  //     currentClientY,
  //     summaryDropdownElWidth,
  //     summaryDropdownElHeight
  //   )
  //   summaryDropdown.x = dropdownX
  //   summaryDropdown.y = dropdownY
  // }
}


defineExpose({
  openSummaryDropdown
})
</script>

<style lang="scss" scoped>
.dms-summary-dropdown {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #ebeef5;
  padding: 5px 8px;
  border-radius: 4px;
}
</style>
