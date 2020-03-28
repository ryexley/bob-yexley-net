import React, { Fragment } from "react"
import PropTypes from "prop-types"
import Obfuscate from "react-obfuscate"

export const Contact = ({ data: { email, phoneNumber } }) => {
  return (
    <Fragment>
      <section>
        <div className="container">
          <div className="label">Contact Information</div>
          <div className="contacts">
            <Obfuscate
              tel={phoneNumber}
              className="resume-contact"
              style={{ display: "inline-block" }} />
            <Obfuscate
              email={email}
              className="resume-contact"
              style={{ display: "inline-block" }} />
          </div>
        </div>
      </section>
      <style jsx>{`
        section {
          background: #b7ef13;
          padding: 1rem;
        }

        .container {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          margin: 0 auto;
          max-width: 50rem;
        }

        .contacts {
          display: flex;
        }

        :global(.resume-contact) {
          border-bottom: 0;
          margin-left: 1rem;

          &:hover {
            border-bottom: 0;
          }
        }

        @below 500px {
          .container {
            align-items: center;
            flex-direction: column;
          }

          .contacts {
            flex-direction: column;
            margin-top: 0.5rem;
          }

          :global(.resume-contact) {
            margin-left: 0;
          }
        }
      `}</style>
    </Fragment>
  )
}

Contact.propTypes = {
  data: PropTypes.shape({
    email: PropTypes.string,
    phoneNumber: PropTypes.string
  })
}
