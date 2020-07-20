import React from "react"

export const PdfResumeLayout = ({ children }) => {
  return (
    <main>
      {children}
      <style jsx>{`
        main {
          color: #777;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
          font-size: 16px;
          font-weight: 300;
          padding: 0.5rem 2rem;
        }

        :global(a) {
          color: #906;
        }

        :global(h1),
        :global(h2),
        :global(h3),
        :global(h4) {
          color: #669;
          font-weight: 400;
        }

        :global(h2) {
          border-top: 1px solid #eee;
          margin-top: 2rem;
          padding-top: 1.25rem;
        }

        :global(p),
        :global(ul),
        :global(li) {
          line-height: 1.5rem;
        }
      `}</style>
    </main>
  )
}
