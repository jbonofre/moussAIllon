import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AutoComplete, Input } from 'antd';
import type { InputProps } from 'antd';
import api from './api.ts';

const MAX_SUGGESTIONS = 10;
const DEBOUNCE_MS = 250;

const unique = (labels: (string | undefined | null)[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  labels.forEach((l) => {
    const label = (l ?? '').toString().trim();
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
  });
  return out;
};

export interface SearchAutoCompleteProps {
  placeholder?: string;
  style?: React.CSSProperties;
  allowClear?: boolean;
  enterButton?: InputProps['suffix'] | boolean;
  /** Texte saisi (mode contrôlé, optionnel). */
  value?: string;
  onChange?: (value: string) => void;
  /** Lancée à la validation (Entrée, loupe) et dès qu'une suggestion est choisie. */
  onSearch: (value: string) => void;
  /** Suggestions tirées d'une liste déjà chargée (filtrée localement). */
  source?: (string | undefined | null)[];
  /** Suggestions tirées de l'API : endpoint de recherche (ex. "/clients/search"), appelé avec ?q=. */
  searchUrl?: string;
  /** Libellé affiché pour chaque ligne renvoyée par searchUrl. */
  labelOf?: (row: any) => string | undefined | null;
}

/**
 * Champ de recherche avec complétion : même rendu qu'un Input.Search,
 * mais propose des suggestions pendant la frappe et lance la recherche
 * dès qu'on en choisit une.
 */
const SearchAutoComplete: React.FC<SearchAutoCompleteProps> = ({
  placeholder = 'Recherche',
  style,
  allowClear = true,
  enterButton = true,
  value,
  onChange,
  onSearch,
  source,
  searchUrl,
  labelOf,
}) => {
  const [text, setText] = useState(value ?? '');
  const [remote, setRemote] = useState<string[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    if (value !== undefined) setText(value);
  }, [value]);

  useEffect(() => {
    const q = text.trim();
    if (!searchUrl || !q) {
      setRemote([]);
      return undefined;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(searchUrl, { params: { q } });
        if (id !== requestId.current) return;
        const rows: any[] = Array.isArray(res.data) ? res.data : [];
        const get = labelOf ?? ((r: any) => r?.nom ?? r?.designation);
        setRemote(unique(rows.map(get)).slice(0, MAX_SUGGESTIONS));
      } catch {
        if (id === requestId.current) setRemote([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, searchUrl, labelOf]);

  const options = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const labels = searchUrl
      ? remote
      : unique(source ?? []).filter((l) => l.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
    return labels.map((l) => ({ value: l }));
  }, [text, source, searchUrl, remote]);

  const handleChange = (v: string) => {
    setText(v ?? '');
    onChange?.(v ?? '');
  };

  return (
    <AutoComplete
      style={style}
      value={text}
      options={options}
      onChange={handleChange}
      onSelect={(v: string) => {
        setText(v);
        onChange?.(v);
        onSearch(v);
      }}
    >
      <Input.Search
        placeholder={placeholder}
        allowClear={allowClear}
        enterButton={enterButton}
        onSearch={(v) => onSearch(v)}
      />
    </AutoComplete>
  );
};

export default SearchAutoComplete;
