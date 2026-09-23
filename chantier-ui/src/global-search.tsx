import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Spin, Typography, Tag, Empty } from 'antd';
import {
    TeamOutlined, ToolOutlined, StockOutlined, FileProtectOutlined,
    ShoppingCartOutlined, SearchOutlined,
} from '@ant-design/icons';
import Icon from '@ant-design/icons';
import { ReactComponent as BoatOutlined } from './boat.svg';
import { ReactComponent as EngineOutlined } from './moteur.svg';
import { ReactComponent as TailerOutlined } from './remorque.svg';
import api from './api.ts';
import { useNavigation } from './navigation-context.tsx';

const { Text } = Typography;

type SearchCategory = {
    key: string;
    label: string;
    icon: React.ReactNode;
    endpoint: string;
    color: string;
    route: string;
    renderItem: (item: any) => string;
};

const categories: SearchCategory[] = [
    {
        key: 'clients',
        label: 'Clients',
        icon: <TeamOutlined />,
        endpoint: '/clients/search',
        color: '#1677ff',
        route: '/clients',
        renderItem: (item) => item.nom + (item.email ? ` - ${item.email}` : ''),
    },
    {
        key: 'produits',
        label: 'Produits',
        icon: <StockOutlined />,
        endpoint: '/catalogue/produits/search',
        color: '#52c41a',
        route: '/catalogue/produits',
        renderItem: (item) => `${item.designation || ''}` + (item.ref ? ` - Ref: ${item.ref}` : ''),
    },
    {
        key: 'bateaux',
        label: 'Bateaux',
        icon: <Icon component={BoatOutlined} />,
        endpoint: '/catalogue/bateaux/search',
        color: '#13c2c2',
        route: '/catalogue/bateaux',
        renderItem: (item) => item.designation || '',
    },
    {
        key: 'moteurs',
        label: 'Moteurs',
        icon: <Icon component={EngineOutlined} />,
        endpoint: '/catalogue/moteurs/search',
        color: '#722ed1',
        route: '/catalogue/moteurs',
        renderItem: (item) => item.designation || '',
    },
    {
        key: 'remorques',
        label: 'Remorques',
        icon: <Icon component={TailerOutlined} />,
        endpoint: '/catalogue/remorques/search',
        color: '#fa8c16',
        route: '/catalogue/remorques',
        renderItem: (item) => item.designation || '',
    },
    {
        key: 'fournisseurs',
        label: 'Fournisseurs',
        icon: <FileProtectOutlined />,
        endpoint: '/catalogue/fournisseurs/search',
        color: '#eb2f96',
        route: '/catalogue/fournisseurs',
        renderItem: (item) => `${item.nom || ''}` + (item.email ? ` - ${item.email}` : ''),
    },
    {
        key: 'forfaits',
        label: 'Forfaits',
        icon: <ShoppingCartOutlined />,
        endpoint: '/forfaits/search',
        color: '#faad14',
        route: '/forfaits',
        renderItem: (item) => item.nom || '(Sans nom)',
    },
];

type SearchResult = {
    category: SearchCategory;
    items: any[];
};

export default function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const { navigate } = useNavigation();

    const doSearch = useCallback(async (q: string) => {
        if (!q || q.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const promises = categories.map(async (cat) => {
                try {
                    const res = await api.get(cat.endpoint, { params: { q: q.trim() } });
                    return { category: cat, items: (res.data || []).slice(0, 5) };
                } catch {
                    return { category: cat, items: [] };
                }
            });
            const all = await Promise.all(promises);
            setResults(all.filter((r) => r.items.length > 0));
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setOpen(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(value), 350);
    };

    const handleNavigate = (route: string) => {
        setOpen(false);
        setQuery('');
        setResults([]);
        navigate(route);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const totalResults = results.reduce((sum, r) => sum + r.items.length, 0);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <Input
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Rechercher clients, produits, bateaux..."
                value={query}
                onChange={handleChange}
                onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
                allowClear
                style={{ borderRadius: 10, height: 40 }}
            />
            {open && (query.trim().length >= 2) && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    zIndex: 1000,
                    maxHeight: 480,
                    overflow: 'auto',
                    padding: '8px 0',
                }}>
                    {loading && (
                        <div style={{ padding: 24, textAlign: 'center' }}>
                            <Spin size="small" />
                            <Text type="secondary" style={{ marginLeft: 8 }}>Recherche en cours...</Text>
                        </div>
                    )}
                    {!loading && results.length === 0 && (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Aucun resultat"
                            style={{ padding: '16px 0' }}
                        />
                    )}
                    {!loading && results.map((group) => (
                        <div key={group.category.key}>
                            <div style={{
                                padding: '8px 16px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <Text strong style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8c8c8c' }}>
                                    {group.category.icon}
                                    <span style={{ marginLeft: 6 }}>{group.category.label}</span>
                                </Text>
                                <a
                                    onClick={() => handleNavigate(group.category.route)}
                                    style={{ fontSize: '0.8em', cursor: 'pointer' }}
                                >
                                    Voir tout
                                </a>
                            </div>
                            {group.items.map((item, idx) => (
                                <div
                                    key={item.id || idx}
                                    onClick={() => handleNavigate(group.category.route)}
                                    style={{
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Tag color={group.category.color} style={{ margin: 0, minWidth: 20, textAlign: 'center' }}>
                                        {group.category.icon}
                                    </Tag>
                                    <Text ellipsis style={{ flex: 1 }}>
                                        {group.category.renderItem(item)}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    ))}
                    {!loading && totalResults > 0 && (
                        <div style={{
                            padding: '8px 16px',
                            textAlign: 'center',
                            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                            marginTop: 4,
                        }}>
                            <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                {totalResults} resultat{totalResults > 1 ? 's' : ''} trouve{totalResults > 1 ? 's' : ''}
                            </Text>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
