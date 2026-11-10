/**
 * Mock Storage & Base44 SDK Emulation for Planeación DM
 * Diseños Mágicos S.A.S. - Modo Local Autónomo
 */
(function() {
    console.log("⚡ Iniciando emulador local de Planeación DM...");

    const APP_ID = "6a8b81f614d4e9ed9a46c710";

    // 1. Asegurar sesión activa
    if (!localStorage.getItem('base44_access_token')) {
        localStorage.setItem('base44_access_token', 'local_planeacion_token');
    }
    if (!localStorage.getItem('token')) {
        localStorage.setItem('token', 'local_planeacion_token');
    }

    // 2. Almacenamiento local persistente
    const initialData = window.__INITIAL_DATA__ || {};

    function getEntityData(entityName) {
        const key = `planeacion_${entityName}`;
        let raw = localStorage.getItem(key);
        if (!raw) {
            const initial = initialData[entityName] || [];
            localStorage.setItem(key, JSON.stringify(initial));
            return initial;
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error(`Error parsing localStorage for ${key}`, e);
            return [];
        }
    }

    function saveEntityData(entityName, items) {
        const key = `planeacion_${entityName}`;
        localStorage.setItem(key, JSON.stringify(items));
    }

    // 3. Comparador y filtro avanzado (estilo MongoDB / Base44)
    function matchItem(item, criteria) {
        if (!criteria || typeof criteria !== 'object') return true;
        for (const [k, v] of Object.entries(criteria)) {
            const itemVal = item[k];
            if (v !== null && typeof v === 'object') {
                if ('$ne' in v) {
                    if (itemVal === v.$ne) return false;
                }
                if ('$in' in v) {
                    if (!Array.isArray(v.$in) || !v.$in.includes(itemVal)) return false;
                }
                if ('$nin' in v) {
                    if (Array.isArray(v.$nin) && v.$nin.includes(itemVal)) return false;
                }
                if ('$gt' in v && !(itemVal > v.$gt)) return false;
                if ('$gte' in v && !(itemVal >= v.$gte)) return false;
                if ('$lt' in v && !(itemVal < v.$lt)) return false;
                if ('$lte' in v && !(itemVal <= v.$lte)) return false;
            } else {
                if (itemVal !== v) return false;
            }
        }
        return true;
    }

    function sortItems(items, sortField) {
        if (!sortField || typeof sortField !== 'string') return items;
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.substring(1) : sortField;
        return [...items].sort((a, b) => {
            let va = a[field] ?? '';
            let vb = b[field] ?? '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return desc ? 1 : -1;
            if (va > vb) return desc ? -1 : 1;
            return 0;
        });
    }

    // 4. Implementación genérica de operaciones de entidad
    function createEntityHandler(entityName) {
        return {
            list: async (order = "-created_date", limit = 1000) => {
                let items = getEntityData(entityName);
                items = sortItems(items, order);
                return items.slice(0, limit);
            },
            filter: async (criteria = {}, sort = "-created_date", limit = 1000, offset = 0) => {
                let items = getEntityData(entityName);
                items = items.filter(item => matchItem(item, criteria));
                items = sortItems(items, sort);
                if (typeof offset === 'number' && typeof limit === 'number') {
                    return items.slice(offset, offset + limit);
                }
                return items;
            },
            get: async (id) => {
                const items = getEntityData(entityName);
                const found = items.find(it => String(it.id) === String(id));
                if (!found) throw new Error(`${entityName} con id ${id} no encontrado`);
                return found;
            },
            create: async (data) => {
                const items = getEntityData(entityName);
                const newItem = {
                    ...data,
                    id: data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    created_date: new Date().toISOString(),
                    updated_date: new Date().toISOString()
                };
                items.unshift(newItem);
                saveEntityData(entityName, items);
                console.log(`[CREATE ${entityName}]`, newItem);
                return newItem;
            },
            update: async (id, data) => {
                const items = getEntityData(entityName);
                const idx = items.findIndex(it => String(it.id) === String(id));
                if (idx === -1) throw new Error(`${entityName} con id ${id} no encontrado`);
                const updated = {
                    ...items[idx],
                    ...data,
                    updated_date: new Date().toISOString()
                };
                items[idx] = updated;
                saveEntityData(entityName, items);
                console.log(`[UPDATE ${entityName}]`, updated);
                return updated;
            },
            delete: async (id) => {
                let items = getEntityData(entityName);
                items = items.filter(it => String(it.id) !== String(id));
                saveEntityData(entityName, items);
                console.log(`[DELETE ${entityName}]`, id);
                return { success: true, id };
            }
        };
    }

    // 5. Proxy dinámico para window.vr.entities
    const entitiesProxy = new Proxy({}, {
        get(target, prop) {
            if (typeof prop !== 'string') return undefined;
            if (!target[prop]) {
                target[prop] = createEntityHandler(prop);
            }
            return target[prop];
        }
    });

    // 6. Definición global de window.vr (Mock del cliente Base44)
    window.vr = {
        auth: {
            me: async () => ({
                id: "1",
                name: "Administrador Planeación DM",
                email: "admin@disenosmagicos.com",
                role: "admin",
                created_date: new Date().toISOString()
            }),
            logout: async () => {
                localStorage.removeItem('base44_access_token');
                localStorage.removeItem('token');
                window.location.reload();
            },
            redirectToLogin: () => {
                console.log("Mock: login no requerido en modo local.");
            },
            isAuthenticated: () => true
        },
        entities: entitiesProxy
    };

    // 7. Interceptor de fetch para URLs que el bundle consulte por HTTP
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init) {
        const url = typeof resource === 'string' ? resource : (resource ? resource.url : '');
        
        // Public settings handshake
        if (url.includes('/api/apps/public/prod/public-settings/')) {
            return new Response(JSON.stringify({
                id: APP_ID,
                public_settings: "public_without_login"
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Logs de telemetría (silenciar)
        if (url.includes('/api/app-logs/')) {
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Endpoint User/me
        if (url.includes('/entities/User/me')) {
            return new Response(JSON.stringify({
                user: {
                    id: "1",
                    name: "Administrador Planeación DM",
                    email: "admin@disenosmagicos.com",
                    role: "admin"
                },
                isAuthenticated: true
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Entities REST fallback
        const matchEntity = url.match(/\/entities\/([A-Za-z0-9_]+)(\/([^\?]+))?(\?.*)?$/);
        if (matchEntity) {
            const entityName = matchEntity[1];
            const entityId = matchEntity[3];
            const handler = entitiesProxy[entityName];
            const method = (init && init.method) ? init.method.toUpperCase() : 'GET';

            try {
                if (method === 'GET') {
                    if (entityId) {
                        const item = await handler.get(entityId);
                        return new Response(JSON.stringify(item), { headers: { 'Content-Type': 'application/json' } });
                    } else {
                        const items = await handler.list("-created_date", 2000);
                        return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
                    }
                } else if (method === 'POST') {
                    const body = init && init.body ? JSON.parse(init.body) : {};
                    const created = await handler.create(body);
                    return new Response(JSON.stringify(created), { headers: { 'Content-Type': 'application/json' } });
                } else if (method === 'PUT' || method === 'PATCH') {
                    const body = init && init.body ? JSON.parse(init.body) : {};
                    const updated = await handler.update(entityId, body);
                    return new Response(JSON.stringify(updated), { headers: { 'Content-Type': 'application/json' } });
                } else if (method === 'DELETE') {
                    const del = await handler.delete(entityId);
                    return new Response(JSON.stringify(del), { headers: { 'Content-Type': 'application/json' } });
                }
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return originalFetch.apply(this, arguments);
    };

    console.log("✅ Planeación DM lista en modo local persistente.");
})();
