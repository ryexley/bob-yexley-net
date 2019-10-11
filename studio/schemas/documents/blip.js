export default {
  name: 'blip',
  type: 'document',
  title: 'Blips',
  fields: [
    {
      name: 'body',
      type: 'markdown',
      title: 'Body'
    }
  ],
  orderings: [
    {
      name: 'createdDateAsc',
      title: 'Created date new –> old',
      by: [
        {
          field: '_createdAt',
          direction: 'desc'
        }
      ]
    }
  ]
}
