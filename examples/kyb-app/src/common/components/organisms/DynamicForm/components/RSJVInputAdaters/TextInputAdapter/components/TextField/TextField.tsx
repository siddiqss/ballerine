import { TextArea } from '@ballerine/ui';
import { Input } from '@ballerine/ui';
import { FieldProps } from '@rjsf/utils';
import { useCallback } from 'react';

export const TextField = ({ id, name, uiSchema, formData, onChange }: FieldProps<string>) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  const inputProps = {
    id,
    name,
    value: formData || '',
    placeholder: uiSchema['ui:placeholder'],
    onChange: handleChange,
  };

  return uiSchema['ui:widget'] === 'textarea' ? (
    <TextArea {...inputProps} />
  ) : (
    <Input {...inputProps} />
  );
};