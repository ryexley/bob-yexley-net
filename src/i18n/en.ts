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
      contactInfoPanel: {
        title: "Contact Us",
        subtitle: "Find and get in touch with Harvest Archery",
        callUsLinkLabel: "Give us a call",
        mapLinkLabel: "Find our shop",
      },
    },
    pageSections: {
      hero: {
        pageTitle: "Home",
        metaDescription: "Bob Yexley",
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
