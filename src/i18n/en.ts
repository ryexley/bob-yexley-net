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
        admin: "Admin",
        blip: "Blip",
        profile: "Profile",
        logout: "Sign Out",
        profileDrawer: {
          title: "Profile",
          actions: {
            close: "Close",
            edit: "Edit",
            cancelEdit: "Cancel",
            regenerateAvatar: "Re-generate avatar colors",
            save: "Save",
            saving: "Saving...",
          },
          tooltips: {
            regenerateAvatar:
              "Re-generate your icon colors. Feel free to do this as many times as you like until you get a combination and pattern that you like.",
          },
          fields: {
            email: "Email",
            name: "Name",
            role: "Role",
            status: "Account Status",
            joinedAt: "Joined at",
          },
          values: {
            unavailable: "Unavailable",
          },
          status: {
            active: "Active",
            pending: "Pending",
            locked: "Locked",
            visitor: "Visitor",
            admin: "Admin",
            superuser: "Superuser",
          },
          notifications: {
            saveSuccess: "Profile updated.",
            saveError: "Unable to update your profile right now.",
          },
        },
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
            placeholder: "What's your name?",
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
          codes: {
            validationLoginRequired: "Please provide your email and a 6-digit PIN.",
            validationSignupRequired:
              "Please provide your email, name, and a 6-digit PIN.",
            invalidEmailOrPin: "Invalid email or PIN. Please try again.",
            visitorLocked:
              "Something's not working right now. Text or call or contact me somehow, and we'll get it sorted out.",
            signupEmailExists: "An account already exists for this email.",
            signupInvalidEmail: "Please provide a valid email address.",
            signupUnavailable: "Unable to create visitor account right now.",
            unexpected: "Unable to authenticate right now.",
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
  users: {
    shared: {
      statuses: {
        all: "All",
        pending: "Pending",
        active: "Active",
        locked: "Locked",
      },
      roles: {
        visitor: "Visitor",
        admin: "Admin",
        superuser: "Superuser",
      },
    },
    components: {
      userEditDrawer: {
        title: "Edit User",
        actions: {
          close: "Close",
          cancel: "Cancel",
          save: "Save",
          saving: "Saving...",
        },
        fields: {
          email: "Email",
          joinedAt: "Joined at",
          role: "Role",
          status: {
            label: "Status",
          },
          trusted: {
            label: "Trusted commenter",
          },
          pin: {
            label: "Reset PIN",
          },
          notes: {
            label: "Notes",
            placeholder: "Private notes about this user...",
            hint: "These notes are only visible to superusers.",
          },
        },
        values: {
          unavailable: "Unavailable",
        },
        notifications: {
          saveSuccess: "User updated.",
          saveSuccessWithPinReset: "User updated and PIN reset.",
          saveError: "Unable to update this user right now.",
        },
      },
    },
    views: {
      index: {
        pageTitle: "Users",
        metaDescription: "Admin user management",
        kicker: "Superuser",
        title: "Users",
        subtitle:
          "Review visitor accounts, search and filter the list, and update account status, notes, or PINs.",
        loading: "Loading users...",
        summary: "Showing {visible} of {total} users",
        actions: {
          backToAdmin: "admin",
          showFilters: "Show filters",
          hideFilters: "Hide filters",
          clearFilters: "Clear filters",
        },
        sort: {
          fieldLabel: "Sort by",
          fields: {
            createdAt: "Created date",
            displayName: "Name",
          },
          direction: {
            asc: "Ascending",
            desc: "Descending",
          },
        },
        filters: {
          search: {
            label: "Search",
            placeholder: "Search by name or email",
          },
          status: {
            label: "Status",
          },
        },
        fields: {
          joinedAt: "Joined",
        },
        values: {
          unavailable: "Unavailable",
        },
        empty: {
          noUsers: "No users yet.",
          noMatches: "No users match the current filters.",
        },
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
          addReaction: "Add reaction",
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
          toggleToolbar: "Toggle formatting toolbar",
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
      commentEditor: {
        modeLabel: "Comment",
        titles: {
          new: "New comment",
          edit: "Edit comment",
        },
        placeholder: "Write a comment...",
        actions: {
          close: "Close",
          delete: "Delete comment",
          save: "Save comment",
          saving: "Saving...",
        },
        confirmDelete: {
          title: "Delete comment?",
          prompt: "This permanently deletes the comment.",
          actions: {
            confirm: "Delete",
            confirming: "Deleting...",
            cancel: "Cancel",
          },
        },
      },
      commentThread: {
        title: "Comments",
        disabled: "Comments are currently disabled for this blip.",
        unknownAuthor: "Visitor",
        statuses: {
          pending: "Pending review",
          rejected: "Rejected",
        },
        actions: {
          addComment: "Add comment",
          enableComments: "Enable comments",
          disableComments: "Disable comments",
          toolbarAriaLabel: "Comment actions",
          edit: "Edit",
          delete: "Delete",
          approve: "Approve",
          reject: "Reject",
        },
        confirmDelete: {
          title: "Delete comment?",
          prompt: "This permanently deletes the comment and cannot be undone.",
          actions: {
            confirm: "Delete",
            confirming: "Deleting...",
            cancel: "Cancel",
          },
        },
      },
    },
    reactions: {
      errors: {
        blipIdRequired: "A blip ID is required to react.",
        authRequired: "Please log in to react.",
        visitorLocked:
          "Something's not working right now. Text or call or contact me somehow, and we'll get it sorted out.",
        limitReached: "You can add up to 3 reactions per blip. Remove one to add another.",
        invalidEmoji: "That reaction is not available.",
        unknown: "Unable to update reactions right now.",
      },
      tooltips: {
        limitReached: "You can only choose three reactions per blip.",
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
    views: {
      index: {
        pageTitle: "Admin",
        metaDescription: "Admin home",
        kicker: "Superuser",
        title: "Admin",
        subtitle: "Manage privileged site areas from one place.",
        loading: "Loading admin modules...",
        cards: {
          users: {
            title: "Users",
            description:
              "Review visitor accounts, update statuses, reset PINs, and keep private notes.",
            total: "{count} total",
            statuses: {
              pending: "{count} pending",
              active: "{count} active",
              locked: "{count} locked",
            },
          },
        },
      },
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
