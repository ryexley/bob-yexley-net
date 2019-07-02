export default {
  widgets: [
    {
      name: 'sanity-tutorials',
      options: {
        templateRepoId: 'sanity-io/sanity-template-gatsby-blog'
      }
    },
    {name: 'structure-menu'},
    {
      name: 'project-info',
      options: {
        __experimental_before: [
          {
            name: 'netlify',
            options: {
              description:
                'NOTE: Because these sites are static builds, they need to be re-deployed to see the changes when documents are published.',
              sites: [
                {
                  buildHookId: '5d1b498bd3745c85780f3e0a',
                  title: 'Sanity Studio',
                  name: 'bob-yexley-net-studio',
                  apiId: 'f913be38-5bfc-4c05-a7bc-2e43b8a92264'
                },
                {
                  buildHookId: '5d1b498be2c29e5a6a5ed71f',
                  title: 'Blog Website',
                  name: 'bob-yexley-net',
                  apiId: '75de913c-f2d6-4f3e-9e1d-4f4fdc0cda28'
                }
              ]
            }
          }
        ],
        data: [
          {
            title: 'GitHub repo',
            value: 'https://github.com/ryexley/bob-yexley-net',
            category: 'Code'
          },
          {title: 'Frontend', value: 'https://bob-yexley-net.netlify.com', category: 'apps'}
        ]
      }
    },
    {name: 'project-users', layout: {height: 'auto'}},
    {
      name: 'document-list',
      options: {title: 'Recent blog posts', order: '_createdAt desc', types: ['post']},
      layout: {width: 'medium'}
    }
  ]
}
