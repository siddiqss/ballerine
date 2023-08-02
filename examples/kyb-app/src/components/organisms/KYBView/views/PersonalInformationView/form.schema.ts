import { RJSFSchema } from '@rjsf/utils';

export const formSchema: RJSFSchema = {
  type: 'object',
  title: 'Personal information',
  properties: {
    name: {
      type: 'object',
      title: '',
      properties: {
        firstName: {
          title: 'Name',
          type: 'string',
        },
        lastName: {
          title: '',
          type: 'string',
        },
      },
      required: ['firstName', 'lastName'],
    },
    title: {
      title: 'Title',
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
      title: 'Company Email',
    },
    birthDate: {
      type: 'string',
      format: 'date',
      title: 'Date of Birth',
    },
    phone: {
      type: 'string',
      title: 'Phone Number',
    },
    companyCheck: {
      title: 'dfrd',
      type: 'boolean',
      description: 'I have the signing authority for this company',
      default: true,
    },
  },
  required: ['name', 'title', 'email', 'birthDate'],
};