import { createEffect, onCleanup, onMount } from "solid-js"
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js"
import "./pageviews-chart.css"

Chart.register(
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
)

type PageviewsChartProps = {
  data: ChartData<"line">
  options?: ChartOptions<"line">
  class?: string
}

export function PageviewsChart(props: PageviewsChartProps) {
  let canvasRef!: HTMLCanvasElement
  let chart: Chart<"line"> | undefined

  onMount(() => {
    chart = new Chart(canvasRef, {
      type: "line",
      data: props.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
          },
        },
        elements: {
          line: {
            tension: 0.3,
            fill: "origin",
          },
          point: {
            radius: 0,
            hitRadius: 10,
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
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
    <div class={props.class ?? "pageviews-chart"}>
      <canvas ref={canvasRef} />
    </div>
  )
}
