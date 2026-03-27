/* eslint-disable quotes */
export const en = {
  site: {
    title: "bob.yexley.net",
    description: "the personal web site of Bob Yexley",
    url: "https://bob.yexley.net",
  },
  shared: {
    pageTitle: "bob.yexley.net",
    pageTitleDescription: "the personal web site of Bob Yexley",
    components: {
      confirmDialog: {
        actions: {
          cancel: "Cancel",
          confirm: "Confirm",
          confirming: "Working...",
        },
      },
      image: {
        defaultImageAlt: "Image alt text not available",
        imageStatusPending: "Image load pending ...",
        imageStatusLoading: "Image loading ...",
        imageStatusLoaded: 'Image - "{alt}" {cr}',
        imageStatusError: "Image - {alt} - failed to load.",
      },
      unsplashImage: {
        attribution: "Photo by {photographer} at Unsplash",
      },
      notification: {
        region: {
          ariaLabel: "Notifications ({hotkey})",
        },
        actions: {
          closeAriaLabel: "Close notification",
          actionsGroupAriaLabel: "Notification actions",
        },
      },
    },
  },
  home: {
    components: {
      mainHeader: {
        mobileNav: {
          title: "Menu",
          subtitle: "Mobile navigation menu",
        },
      },
      userMenu: {
        header: { label: "Signed in as" },
        blip: "Blip",
        logout: "Sign Out",
      },
    },
    pageSections: {
      hero: {
        pageTitle: "Home",
        metaDescription: "Bob Yexley",
      },
      signals: {
        pageTitle: "Signals",
        metaDescription: "Signals",
        actions: {
          seeMore: "See More",
        },
      },
    },
  },
  auth: {
    components: {
      visitorAuthModal: {
        login: {
          title: "Login",
          subtitle: "Enter your credentials to interact with the site.",
        },
        signup: {
          title: "Sign Up",
          subtitle: "Create your visitor account to interact with the site.",
        },
        fields: {
          email: {
            label: "Email",
            placeholder: "name@email.com",
          },
          pin: {
            label: "PIN",
          },
          name: {
            label: "Name",
            placeholder: "How should others see your name?",
          },
        },
        actions: {
          cancel: "Nevermind",
          login: {
            default: "Login",
            submitting: "Logging in...",
          },
          signUp: {
            default: "Create account",
            submitting: "Creating account...",
          },
        },
        modeSwitch: {
          login: {
            prefix: "Don't have an account? ",
            link: "Sign up.",
          },
          signup: {
            prefix: "Already have an account? ",
            link: "Login.",
          },
        },
        help: {
          trigger: "What's this?",
          backAction: "Back",
          loginContent:
            "Log in with your email and PIN to interact with the site. If your credentials are not working, verify your PIN and try again.",
          signupContent:
            "Create a visitor account with your email, a 6-digit PIN, and your name. Your name is how other visitors will recognize you when you interact.",
        },
        errors: {
          notWired: "Visitor auth flow is not wired yet.",
          authFailed: "Unable to authenticate.",
          unexpected: "Unable to authenticate right now.",
          validation: {
            loginRequired: "Please provide your email and a 6-digit PIN.",
            signupRequired:
              "Please provide your email, name, and a 6-digit PIN.",
          },
        },
      },
    },
    views: {
      login: {
        pageTitle: "Uuummmm ... you probably don't belong here",
        loginFormCardTitle: "Login",
        loginFormCardDescription:
          "Enter your credentials to access privileged content.",
        emailFieldLabel: "Email",
        emailFieldPlaceholder: "You probably don't belong here",
        passwordFieldLabel: "Password",
        passwordFieldPlaceholder: "◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌◌",
        submitButton: {
          enabled: { label: "Login" },
          disabled: { label: "Nope" },
          submitting: { label: "Logging in..." },
        },
        returnHomeLink: "Get me outta here",
        loginFailedError: "Login failed.",
      },
    },
  },
  blips: {
    views: {
      index: {
        pageTitle: "Blips",
        metaDescription: "Blips",
        loading: "Loading blips...",
        nav: {
          home: "Home",
          signals: "Signals",
          blips: "Blips",
        },
        paging: {
          actions: {
            showMore: "Show more",
            loading: "Loading more...",
          },
        },
      },
      detail: {
        pageTitle: "Blip",
        metaDescription: "Blip",
        loading: "Loading blip...",
        notFound: "Blip not found.",
        actions: {
          backToBlips: "back",
          postUpdate: "Post update",
          hideUpdateComposer: "Hide composer",
        },
        updates: {
          label: "Updates",
          title: "Updates ({count})",
          placeholder: "Post a quick update...",
          empty: "No updates yet.",
          editor: {
            newLabel: "Update",
            editingLabel: "Editing update",
          },
          actions: {
            submit: "Post update",
            submitting: "Posting...",
            delete: "Delete update",
          },
          confirmDelete: {
            title: "Delete update?",
            persistedPrompt:
              "This permanently deletes the update from the database and cannot be undone.",
            unsavedPrompt:
              "This clears the current unsaved update from the editor.",
            actions: {
              confirm: "Delete",
              confirming: "Deleting...",
              cancel: "Cancel",
            },
          },
          confirmCloseDraft: {
            title: "Discard update draft?",
            prompt:
              "Closing now will discard this unpublished update draft and remove it.",
            actions: {
              close: "Discard and close",
              closing: "Discarding...",
              cancel: "Keep editing",
            },
          },
        },
      },
      tag: {
        pageTitle: "Blips tagged {tag}",
        metaDescription: "Blips tagged {tag}",
        loading: "Loading blips tagged {tag}...",
        empty: "There are no blips that use this tag.",
        paging: {
          actions: {
            showMore: "Show more",
            loading: "Loading more...",
          },
        },
      },
    },
    components: {
      blip: {
        actions: {
          readMore: "Read more",
          addReaction: "Add reaction",
        },
        readMoreDialog: {
          closeAriaLabel: "Close dialog",
        },
      },
      blipActions: {
        toolbarAriaLabel: "Blip actions",
        confirmDelete: {
          title: "Delete blip?",
          prompt:
            "This action permanently deletes this blip and cannot be undone.",
          actions: {
            confirm: "Delete",
            confirming: "Deleting...",
            cancel: "Cancel",
          },
        },
      },
      blipEditor: {
        placeholder: "What's on your mind?",
        tags: {
          ariaLabel: "Blip tags",
          placeholder: "tags...",
        },
        draftPicker: {
          new: "New Blip",
          untitled: "Untitled draft",
        },
        status: {
          idle: "Draft",
          saving: "Saving...",
          saved: "Saved",
          published: "Published",
          error: "Error saving",
        },
        actions: {
          close: "close",
          save: "Save",
          publish: "Publish",
          unpublish: "Unpublish",
          delete: "Delete Draft",
        },
        confirmDelete: {
          title: "Delete draft blip?",
          prompt:
            "This removes the draft from your cache and the database if it has already been synced.",
          actions: {
            confirm: "Delete",
            confirming: "Deleting...",
            cancel: "Keep draft",
          },
        },
      },
    },
    util: {
      relativeTime: {
        justNow: "just now",
        minutesAgo:
          "{minutes, plural, one {a minute ago} other {# minutes ago}}",
        hoursAgo: "{hours, plural, one {an hour ago} other {# hours ago}}",
        daysAgo: "{days, plural, one {yesterday} other {# days ago}}",
        weeksAgo: "{weeks, plural, one {last week} other {# weeks ago}}",
        monthsAgo: "{months, plural, one {last month} other {# months ago}}",
        yearsAgo: "{years, plural, one {last year} other {# years ago}}",
      },
    },
  },
  admin: {
    layout: {
      subtitle: "admin",
    },
    pages: {},
    modules: {
      auth: {
        login: {
          prompt: "Login or Request Access to {br} Harvest Archery Admin",
          googleAuthButtonLabel: "Continue with Google",
        },
        logout: {
          heading: "Logged Out",
          prompt:
            "You've been logged out, and should be redirected shortly. If you are not redirected, you can click on the logo above to return to the home page.",
        },
      },
      home: {
        eventCardTitle: "Events",
      },
      events: {
        title: "Events",
      },
    },
  },
}
