import { useParams } from 'react-router-dom';
import { useStorageFilesQuery } from '../../../../domains/storage/hooks/queries/useStorageFilesQuery/useStorageFilesQuery';
import { useFilterEntity } from '../../../../domains/entities/hooks/useFilterEntity/useFilterEntity';
import { useUpdateWorkflowByIdMutation } from '../../../../domains/workflows/hooks/mutations/useUpdateWorkflowByIdMutation/useUpdateWorkflowByIdMutation';
import { useCaseState } from '../../components/Case/hooks/useCaseState/useCaseState';
import { useAuthenticatedUserQuery } from '../../../../domains/auth/hooks/queries/useAuthenticatedUserQuery/useAuthenticatedUserQuery';
import { toStartCase } from '../../../../common/utils/to-start-case/to-start-case';
import { components } from './components';
import { useFilterId } from '../../../../common/hooks/useFilterId/useFilterId';
import { useWorkflowQuery } from '../../../../domains/workflows/hooks/queries/useWorkflowQuery/useWorkflowQuery';
import { getDocumentsByCountry, TDocument } from '@ballerine/common';

const convertSnakeCaseToTitleCase = (input: string): string =>
  input
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const extractCountryCodeFromWorkflow = workflow => {
  return workflow?.context?.documents?.find(document => {
    return document?.issuer?.country;
  })?.issuer?.country;
};

const uniqueArrayByKey = (array, key) => {
  return [...new Map(array.map(item => [item[key], item])).values()];
};
const composePickableCategoryType = (
  categoryValue: string,
  typeValue: string,
  documentsSchema: TDocument[],
) => {
  const documentTypesDropdownOptions: Array<{ value: string; label: string }> = [];
  const documentCategoryDropdownOptions: Array<{ value: string; label: string }> = [];

  documentsSchema.forEach(document => {
    const category = document.category;
    if (category) {
      documentCategoryDropdownOptions.push({
        value: category,
        label: convertSnakeCaseToTitleCase(category),
      });
    }
    const type = document.type;
    if (type) {
      documentTypesDropdownOptions.push({
        value: type,
        label: convertSnakeCaseToTitleCase(type),
      });
    }
  });

  const typeDropdownOptions = uniqueArrayByKey(documentTypesDropdownOptions, 'value');
  const categoryDropdownOptions = uniqueArrayByKey(documentCategoryDropdownOptions, 'value');
  return {
    type: { title: 'type', type: 'string', dropdownOptions: typeDropdownOptions, value: typeValue },
    category: {
      title: 'category',
      type: 'string',
      dropdownOptions: categoryDropdownOptions,
      value: categoryValue,
    },
  };
};

const isExistingSchemaForDocument = (documentsSchema: TDocument[]) => {
  return documentsSchema.length > 0;
};

function omit(obj, ...props) {
  const result = { ...obj };
  props.forEach(function (prop) {
    delete result[prop];
  });
  return result;
}
export const useEntity = () => {
  const { entityId } = useParams();
  const filterId = useFilterId();

  const { data: workflow, isLoading } = useWorkflowQuery({ workflowId: entityId, filterId });
  const docsData = useStorageFilesQuery(
    workflow.context.documents?.flatMap(({ pages }) =>
      pages?.map(({ ballerineFileId }) => ballerineFileId),
    ),
  );

  const results = [];
  workflow.context.documents?.forEach((document, docIndex) => {
    document?.pages.forEach((page, pageIndex) => {
      if (!results[docIndex]) {
        results[docIndex] = [];
      }
      results[docIndex][pageIndex] = docsData.shift().data;
    });
  });
  const filterEntity = useFilterEntity();
  const selectedEntity = workflow.entity;

  const issuerCountryCode = extractCountryCodeFromWorkflow(workflow);
  const documentsSchema = issuerCountryCode && getDocumentsByCountry(issuerCountryCode);

  const octetToFileType = (base64: string, fileType: string) =>
    base64?.replace(/application\/octet-stream/gi, fileType);
  const { mutate: mutateUpdateWorkflowById, isLoading: isLoadingUpdateWorkflowById } =
    useUpdateWorkflowByIdMutation({
      workflowId: workflow.id,
    });
  const { data: session } = useAuthenticatedUserQuery();
  const caseState = useCaseState(session?.user, workflow);
  const contextEntity = workflow.context.entity;
  const contextDocuments = workflow.context.documents;
  const tasks = contextEntity
    ? [
        ...(contextDocuments?.map(
          (
            { id, type: docType, category, issuer, properties, propertiesSchema, decision },
            docIndex,
          ) => {
            const additionProperties =
              isExistingSchemaForDocument(documentsSchema) &&
              composePickableCategoryType(category, docType, documentsSchema);

            return [
              {
                id: 'header',
                type: 'container',
                value: [
                  {
                    type: 'heading',
                    value: `${convertSnakeCaseToTitleCase(
                      category,
                    )} - ${convertSnakeCaseToTitleCase(docType)}`,
                  },
                  {
                    id: 'actions',
                    type: 'container',
                    value: [
                      {
                        type: 'callToAction',
                        value: 'Reject',
                        data: {
                          id,
                          disabled: Boolean(decision?.status),
                          approvalStatus: 'rejected',
                        },
                      },
                      {
                        type: 'callToAction',
                        value: 'Approve',
                        data: {
                          id,
                          disabled: Boolean(decision?.status),
                          approvalStatus: 'approved',
                        },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'container',
                value: [
                  {
                    id: 'decision',
                    type: 'details',
                    value: {
                      id,
                      title: `${category} - ${docType}`,
                      data: Object.entries(
                        {
                          ...additionProperties,
                          ...propertiesSchema?.properties,
                        } ?? {},
                      )?.map(
                        ([
                          title,
                          { type, format, pattern, isEditable = true, dropdownOptions, value },
                        ]) => {
                          const fieldValue = value || (properties?.[title] ?? '');

                          return {
                            title,
                            value: fieldValue,
                            type,
                            format,
                            pattern,
                            isEditable: caseState.writeEnabled && isEditable,
                            dropdownOptions,
                          };
                        },
                      ),
                    },
                  },
                  {
                    type: 'details',
                    value: {
                      id,
                      title: 'Decision',
                      data: Object.entries(decision ?? {}).map(([title, value]) => ({
                        title,
                        value,
                      })),
                    },
                  },
                ],
              },
              {
                type: 'multiDocuments',
                value: {
                  isLoading: docsData?.some(({ isLoading }) => isLoading),
                  data:
                    contextDocuments?.[docIndex]?.pages?.map(
                      ({ type, metadata, data }, pageIndex) => ({
                        title: `${category} - ${docType}${
                          metadata?.side ? ` - ${metadata?.side}` : ''
                        }`,
                        imageUrl:
                          type === 'pdf'
                            ? octetToFileType(results[docIndex][pageIndex], `application/${type}`)
                            : results[docIndex][pageIndex],
                        fileType: type,
                      }),
                    ) ?? [],
                },
              },
            ];
          },
        ) ?? []),
        [
          {
            id: 'entity-details',
            type: 'details',
            value: {
              title: `${toStartCase(contextEntity?.type)} Information`,
              data: [
                ...Object.entries(omit(contextEntity?.data, 'additionalInfo') ?? {}),
                ...Object.entries(contextEntity?.data?.additionalInfo ?? {}),
              ]?.map(([title, value]) => ({
                title,
                value,
                type: 'string',
                isEditable: false,
              })),
            },
          },
        ],
      ]
    : [];

  return {
    selectedEntity,
    components,
    tasks,
    workflow,
    isLoading,
  };
};