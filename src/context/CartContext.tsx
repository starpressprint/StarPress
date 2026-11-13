"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface CartItemCustomizations {
  name?: string;
  initials?: string;
  personalizedText?: string;
  engraving?: string;
  notes?: string;
  [key: string]: any;
}

export interface CartItem {
  id: string;
  productId?: string;
  productSlug?: string;
  name: string;
  price: number;
  imageSrc: string;
  quantity: number;
  href: string;
  sizeId?: string;
  sizeLabel?: string;
  materialId?: string;
  materialLabel?: string;
  customText?: string;
  customizations?: CartItemCustomizations;
  specs?: Record<string, any>;
  artworkUrl?: string;
  stockQuantity?: number;
  inStock?: boolean;
}

export interface AddItemInput {
  id: string;
  productId?: string;
  productSlug?: string;
  name: string;
  price: number;
  imageSrc: string;
  href?: string;
  quantity?: number;
  sizeId?: string;
  sizeLabel?: string;
  materialId?: string;
  materialLabel?: string;
  customText?: string;
  customizations?: CartItemCustomizations;
  specs?: Record<string, any>;
  artworkUrl?: string;
  stockQuantity?: number;
  inStock?: boolean;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (product: AddItemInput, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateCustomization: (
    id: string,
    updates: {
      customText?: string;
      notes?: string;
      customizations?: CartItemCustomizations;
    }
  ) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
  isLoaded: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "starpress_cart_v2";
const LEGACY_STORAGE_KEY = "starpress_cart_v1";
function validStoredItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CartItem => item && typeof item.id === "string" &&
    typeof item.name === "string" && typeof item.href === "string" &&
    typeof item.imageSrc === "string" && Number.isFinite(item.price) && item.price >= 0 &&
    Number.isSafeInteger(item.quantity) && item.quantity > 0);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on client mount with backward compatibility
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(validStoredItems(JSON.parse(stored)));
      } else {
        // Fallback to legacy key if exists
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy);
          if (Array.isArray(parsedLegacy)) {
            setItems(validStoredItems(parsedLegacy));
          }
        } else {
          setItems([]);
        }
      }
    } catch {
      // Ignore localStorage read errors
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore localStorage write errors
      }
    }
  }, [items, isLoaded]);

  const addItem = (product: AddItemInput, explicitQuantity?: number) => {
    const qty = explicitQuantity !== undefined ? explicitQuantity : product.quantity || 1;
    if (!Number.isSafeInteger(qty) || qty <= 0) return;

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
          // Preserve or update customization if provided
          customText: product.customText !== undefined ? product.customText : updated[existingIndex].customText,
          customizations: product.customizations || updated[existingIndex].customizations,
          specs: product.specs || updated[existingIndex].specs,
          stockQuantity: product.stockQuantity !== undefined ? product.stockQuantity : updated[existingIndex].stockQuantity,
          inStock: product.inStock !== undefined ? product.inStock : updated[existingIndex].inStock,
        };
        return updated;
      }

      const resolvedSlug =
        product.productSlug ||
        (product.href?.includes("/shop/") ? product.href.split("/shop/")[1].split("?")[0] : undefined);

      const newItem: CartItem = {
        id: product.id,
        productId: product.productId || product.id,
        productSlug: resolvedSlug,
        name: product.name,
        price: product.price,
        imageSrc: product.imageSrc,
        quantity: qty,
        href: product.href || `/shop/${product.productId || product.id}`,
        sizeId: product.sizeId,
        sizeLabel: product.sizeLabel,
        materialId: product.materialId,
        materialLabel: product.materialLabel,
        customText: product.customText,
        customizations: product.customizations,
        specs: product.specs,
        artworkUrl: product.artworkUrl,
        stockQuantity: product.stockQuantity,
        inStock: product.inStock,
      };

      return [...prev, newItem];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity)) return;
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const finalQty =
          item.stockQuantity !== undefined && item.stockQuantity > 0 && quantity > item.stockQuantity
            ? item.stockQuantity
            : quantity;
        return { ...item, quantity: finalQty };
      })
    );
  };

  const updateCustomization = (
    id: string,
    updates: {
      customText?: string;
      notes?: string;
      customizations?: CartItemCustomizations;
    }
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const mergedCustomizations = {
          ...(item.customizations || {}),
          ...(updates.customizations || {}),
          ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
          ...(updates.customText !== undefined ? { personalizedText: updates.customText } : {}),
        };
        return {
          ...item,
          customText: updates.customText !== undefined ? updates.customText : item.customText,
          customizations: mergedCustomizations,
          specs: {
            ...(item.specs || {}),
            customText: updates.customText !== undefined ? updates.customText : item.customText,
            notes: updates.notes !== undefined ? updates.notes : item.specs?.notes,
          },
        };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateCustomization,
        clearCart,
        totalCount,
        subtotal,
        isLoaded,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
