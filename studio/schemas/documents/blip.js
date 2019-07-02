import { format } from 'date-fns'

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
  ]
}
