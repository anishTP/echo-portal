import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TextField } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

export function HeaderSearchBar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get('q') || '';
  const [value, setValue] = useState(currentQuery);

  const handleSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const trimmed = value.trim();
        if (trimmed) {
          navigate(`/library?q=${encodeURIComponent(trimmed)}`);
        } else {
          navigate('/library');
        }
      }
    },
    [value, navigate]
  );

  return (
    <TextField.Root
      size="2"
      placeholder="Search..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleSubmit}
      style={{ width: '200px' }}
    >
      <TextField.Slot>
        <MagnifyingGlassIcon height="16" width="16" />
      </TextField.Slot>
    </TextField.Root>
  );
}
