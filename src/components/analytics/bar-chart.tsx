import { createEffect, onCleanup, onMount } from "solid-js"
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js"
import "./bar-chart.css"

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

type BarChartProps = {
  data: ChartData<"bar">
  options?: ChartOptions<"bar">
  class?: string
}

export function BarChart(props: BarChartProps) {
  let canvasRef!: HTMLCanvasElement
  let chart: Chart<"bar"> | undefined

  onMount(() => {
    chart = new Chart(canvasRef, {
      type: "bar",
      data: props.data,
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
          },
          y: {
            grid: {
              display: false,
            },
          },
        },
        ...props.options,
      },
    })

    createEffect(() => {
      if (!chart) {
        return
      }

      chart.data = props.data
      chart.update("active")
    })

    onCleanup(() => {
      chart?.destroy()
      chart = undefined
    })
  })

  return (
    <div class={props.class ?? "bar-chart"}>
      <canvas ref={canvasRef} />
    </div>
  )
}
