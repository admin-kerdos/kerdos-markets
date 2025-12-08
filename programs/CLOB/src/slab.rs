use anchor_lang::prelude::*;
use crate::state::Blob;

pub const IDX_NULL: u32 = u32::MAX;

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct SlabHeader {
    pub capacity: u32,
    pub used: u32,
    pub free_head: u32,
    pub root: u32,
    pub best: u32,
    pub version: u8,
    pub pad: [u8; 3],
}
impl SlabHeader {
    pub const LEN: usize = 4 + 4 + 4 + 4 + 4 + 1 + 3;
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct SlabNode {
    pub price_ticks: u64,
    pub base_qty: u64,
    pub oo: Pubkey,
    pub ts: u64,
    pub parent: u32,
    pub left: u32,
    pub right: u32,
    pub next: u32,
    pub prev: u32,
    pub flags: u8,
    pub pad: [u8; 3],
}
impl SlabNode {
    pub const LEN: usize = 8 + 8 + 32 + 8 + (4 * 5) + 1 + 3;
}

#[error_code]
pub enum SlabError {
    #[msg("invalid slab header")] InvalidHeader,
    #[msg("invalid grow argument")] InvalidGrow,
    #[msg("no free nodes")] NoFreeNodes,
    #[msg("cannot grow capacity")] NoGrowth,
}

pub fn region_len_for(nodes: u32) -> usize {
    SlabHeader::LEN + SlabNode::LEN * nodes as usize
}

pub fn capacity_from_len(total_len: usize) -> u32 {
    if total_len < Blob::LEN + SlabHeader::LEN {
        return 0;
    }
    let slab_bytes = total_len - Blob::LEN - SlabHeader::LEN;
    (slab_bytes / SlabNode::LEN) as u32
}

fn header_off() -> usize { Blob::LEN }
fn node_off(idx: u32) -> usize { Blob::LEN + SlabHeader::LEN + (idx as usize) * SlabNode::LEN }

fn load_header(ai: &AccountInfo<'_>) -> Result<SlabHeader> {
    let data = ai.try_borrow_data()?;
    require!(data.len() >= Blob::LEN + SlabHeader::LEN, SlabError::InvalidHeader);
    let mut rd: &[u8] = &data[header_off()..header_off() + SlabHeader::LEN];
    Ok(SlabHeader::deserialize(&mut rd)?)
}

fn store_header(ai: &AccountInfo<'_>, h: &SlabHeader) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let start = header_off();
    let end = start + SlabHeader::LEN;
    let mut cur = std::io::Cursor::new(&mut data[start..end]);
    h.serialize(&mut cur)?;
    Ok(())
}

fn read_node(ai: &AccountInfo<'_>, idx: u32) -> Result<SlabNode> {
    let data = ai.try_borrow_data()?;
    let off = node_off(idx);
    let mut rd: &[u8] = &data[off..off + SlabNode::LEN];
    Ok(SlabNode::deserialize(&mut rd)?)
}

fn write_node(ai: &AccountInfo<'_>, idx: u32, n: &SlabNode) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let off = node_off(idx);
    let mut cur = std::io::Cursor::new(&mut data[off..off + SlabNode::LEN]);
    n.serialize(&mut cur)?;
    Ok(())
}

pub fn init(ai: &AccountInfo<'_>, cap: u32) -> Result<()> {
    let h = SlabHeader {
        capacity: cap,
        used: 0,
        free_head: if cap > 0 { 0 } else { IDX_NULL },
        root: IDX_NULL,
        best: IDX_NULL,
        version: 1,
        pad: [0; 3],
    };
    store_header(ai, &h)?;
    for i in 0..cap {
        let mut n = SlabNode::default();
        n.next = if i + 1 < cap { i + 1 } else { IDX_NULL };
        write_node(ai, i, &n)?;
    }
    store_header(ai, &h)
}

pub fn grow(ai: &AccountInfo<'_>, new_cap: u32) -> Result<()> {
    let mut h = load_header(ai)?;
    require!(new_cap >= h.capacity, SlabError::InvalidGrow);
    for i in (h.capacity)..new_cap {
        let mut n = SlabNode::default();
        n.next = h.free_head;
        write_node(ai, i, &n)?;
        h.free_head = i;
    }
    h.capacity = new_cap;
    store_header(ai, &h)
}

fn alloc(ai: &AccountInfo<'_>) -> Result<u32> {
    let mut h = load_header(ai)?;
    // Always rebuild the freelist from the current tree to avoid stale or lost pointers.
    if h.used < h.capacity {
        h = rebuild_freelist(ai, h)?;
    }
    // Fallback: if free list is still empty but capacity remains, scan for an unused slot.
    if h.free_head == IDX_NULL && h.used < h.capacity {
        if let Some(idx) = find_unused_index(ai, h.capacity, h.root)? {
            let mut n = SlabNode::default();
            write_node(ai, idx, &n)?;
            h.used = h.used.saturating_add(1);
            store_header(ai, &h)?;
            return Ok(idx);
        }
    }
    require!(h.free_head != IDX_NULL, SlabError::NoFreeNodes);
    let idx = h.free_head;
    let mut n = read_node(ai, idx)?;
    h.free_head = n.next;
    n.next = IDX_NULL;
    n.prev = IDX_NULL;
    write_node(ai, idx, &n)?;
    h.used = h.used.saturating_add(1);
    store_header(ai, &h)?;
    Ok(idx)
}

fn free(ai: &AccountInfo<'_>, idx: u32) -> Result<()> {
    let mut h = load_header(ai)?;
    let mut n = read_node(ai, idx)?;
    n.next = h.free_head;
    write_node(ai, idx, &n)?;
    h.free_head = idx;
    h.used = h.used.saturating_sub(1);
    store_header(ai, &h)
}

fn extreme(ai: &AccountInfo<'_>, mut idx: u32, is_bid_book: bool) -> Result<u32> {
    if idx == IDX_NULL { return Ok(IDX_NULL); }
    loop {
        let n = read_node(ai, idx)?;
        let next = if is_bid_book { n.right } else { n.left };
        if next == IDX_NULL { return Ok(idx); }
        idx = next;
    }
}

fn recompute_best(ai: &AccountInfo<'_>, is_bid_book: bool) -> Result<u32> {
    let h = load_header(ai)?;
    if h.root == IDX_NULL { return Ok(IDX_NULL); }
    extreme(ai, h.root, is_bid_book)
}

fn bst_insert(ai: &AccountInfo<'_>, idx: u32, is_bid_book: bool) -> Result<()> {
    let mut h = load_header(ai)?;
    let ni = read_node(ai, idx)?;
    if h.root == IDX_NULL {
        let mut ni2 = ni;
        ni2.parent = IDX_NULL;
        write_node(ai, idx, &ni2)?;
        h.root = idx;
        h.best = idx;
        store_header(ai, &h)?;
        return Ok(());
    }
    let mut cur = h.root;
    loop {
        let cn = read_node(ai, cur)?;
        if ni.price_ticks < cn.price_ticks {
            if cn.left == IDX_NULL {
                let mut cn2 = cn; cn2.left = idx;
                write_node(ai, cur, &cn2)?;
                let mut ni2 = ni; ni2.parent = cur;
                write_node(ai, idx, &ni2)?;
                break;
            } else { cur = cn.left; }
        } else {
            if cn.right == IDX_NULL {
                let mut cn2 = cn; cn2.right = idx;
                write_node(ai, cur, &cn2)?;
                let mut ni2 = ni; ni2.parent = cur;
                write_node(ai, idx, &ni2)?;
                break;
            } else { cur = cn.right; }
        }
    }
    let best_idx = h.best;
    if best_idx == IDX_NULL {
        h.best = idx;
    } else {
        let bn = read_node(ai, best_idx)?;
        let better = if is_bid_book { ni.price_ticks > bn.price_ticks } else { ni.price_ticks < bn.price_ticks };
        if better { h.best = idx; }
    }
    store_header(ai, &h)
}

fn replace_parent_link(ai: &AccountInfo<'_>, parent: u32, old_child: u32, new_child: u32) -> Result<()> {
    if parent == IDX_NULL { return Ok(()); }
    let mut p = read_node(ai, parent)?;
    if p.left == old_child { p.left = new_child; }
    if p.right == old_child { p.right = new_child; }
    write_node(ai, parent, &p)
}

fn bst_delete(ai: &AccountInfo<'_>, idx: u32, is_bid_book: bool) -> Result<u32> {
    let mut h = load_header(ai)?;
    let mut n = read_node(ai, idx)?;
    let mut to_free = IDX_NULL;
    if n.left == IDX_NULL || n.right == IDX_NULL {
        let child = if n.left != IDX_NULL { n.left } else { n.right };
        if n.parent == IDX_NULL {
            h.root = child;
        } else {
            replace_parent_link(ai, n.parent, idx, child)?;
        }
        if child != IDX_NULL {
            let mut c = read_node(ai, child)?;
            c.parent = n.parent;
            write_node(ai, child, &c)?;
        }
        to_free = idx;
    } else {
        let succ_idx = {
            let mut t = n.right;
            loop {
                let tnode = read_node(ai, t)?;
                if tnode.left == IDX_NULL { break t; }
                t = tnode.left;
            }
        };
        let succ = read_node(ai, succ_idx)?;
        n.price_ticks = succ.price_ticks;
        n.base_qty = succ.base_qty;
        n.oo = succ.oo;
        n.ts = succ.ts;
        write_node(ai, idx, &n)?;
        let s_child = succ.right;
        if succ.parent == IDX_NULL {
            h.root = s_child;
        } else {
            replace_parent_link(ai, succ.parent, succ_idx, s_child)?;
        }
        if s_child != IDX_NULL {
            let mut sc = read_node(ai, s_child)?;
            sc.parent = succ.parent;
            write_node(ai, s_child, &sc)?;
        }
        to_free = succ_idx;
    }
    if h.root == IDX_NULL {
        h.best = IDX_NULL;
    } else {
        h.best = recompute_best(ai, is_bid_book)?;
    }
    store_header(ai, &h)?;
    if to_free != IDX_NULL {
        free(ai, to_free)?;
    }
    Ok(h.best)
}

pub fn ensure_free_nodes_grow<F>(ai: &AccountInfo<'_>, max_cap: u32, need_free: u32, bytes_grow: F) -> Result<()>
where
    F: Fn(usize) -> Result<()>,
{
    let mut h = if ai.data_len() >= Blob::LEN + SlabHeader::LEN { load_header(ai)? } else { SlabHeader::default() };
    if h.capacity == 0 {
        return Ok(());
    }
    // If the freelist pointer is null but the header says space remains, rebuild it from the current tree.
    if h.free_head == IDX_NULL && h.used < h.capacity {
        h = rebuild_freelist(ai, h)?;
    }
    let free_est = h.capacity.saturating_sub(h.used);
    // If the freelist head is null, prefer to grow to replenish nodes even if free_est suggests space.
    if free_est >= need_free && h.free_head != IDX_NULL { return Ok(()); }
    let mut new_cap = h.capacity;
    loop {
        if new_cap >= max_cap { break; }
        let step = 64u32.min(max_cap.saturating_sub(new_cap));
        new_cap = new_cap.saturating_add(step);
        if new_cap.saturating_sub(h.used) >= need_free { break; }
    }
    require!(new_cap > h.capacity, SlabError::NoGrowth);
    let want_len = Blob::LEN + region_len_for(new_cap);
    bytes_grow(want_len)?;
    grow(ai, new_cap)
}

fn rebuild_freelist(ai: &AccountInfo<'_>, mut h: SlabHeader) -> Result<SlabHeader> {
    let mut used: Vec<bool> = vec![false; h.capacity as usize];
    let mut stack: Vec<u32> = vec![];
    if h.root != IDX_NULL {
        stack.push(h.root);
    }
    while let Some(idx) = stack.pop() {
        if idx == IDX_NULL || idx as usize >= used.len() {
            continue;
        }
        if used[idx as usize] {
            continue;
        }
        used[idx as usize] = true;
        let n = read_node(ai, idx)?;
        if n.left != IDX_NULL { stack.push(n.left); }
        if n.right != IDX_NULL { stack.push(n.right); }
    }

    let mut free_head = IDX_NULL;
    for i in (0..h.capacity).rev() {
        if used[i as usize] { continue; }
        // Reset free nodes to a clean default and push onto the freelist.
        let mut n = SlabNode::default();
        n.next = free_head;
        write_node(ai, i, &n)?;
        free_head = i;
    }

    h.used = used.iter().filter(|&&b| b).count() as u32;
    h.free_head = free_head;
    store_header(ai, &h)?;
    Ok(h)
}

fn find_unused_index(ai: &AccountInfo<'_>, capacity: u32, root: u32) -> Result<Option<u32>> {
    let mut used: Vec<bool> = vec![false; capacity as usize];
    let mut stack: Vec<u32> = vec![];
    if root != IDX_NULL { stack.push(root); }
    while let Some(idx) = stack.pop() {
        if idx == IDX_NULL || idx as usize >= used.len() { continue; }
        if used[idx as usize] { continue; }
        used[idx as usize] = true;
        let n = read_node(ai, idx)?;
        if n.left != IDX_NULL { stack.push(n.left); }
        if n.right != IDX_NULL { stack.push(n.right); }
    }
    for i in 0..capacity {
        if !used[i as usize] {
            return Ok(Some(i));
        }
    }
    Ok(None)
}

pub fn insert_order(
    ai: &AccountInfo<'_>,
    is_bid_book: bool,
    price_ticks: u64,
    base_qty: u64,
    oo: Pubkey,
    ts: u64,
) -> Result<()> {
    let idx = alloc(ai)?;
    let n = SlabNode {
        price_ticks,
        base_qty,
        oo,
        ts,
        parent: IDX_NULL,
        left: IDX_NULL,
        right: IDX_NULL,
        next: IDX_NULL,
        prev: IDX_NULL,
        flags: 0,
        pad: [0; 3],
    };
    write_node(ai, idx, &n)?;
    bst_insert(ai, idx, is_bid_book)
}

pub fn peek_best(ai: &AccountInfo<'_>) -> Result<Option<(Pubkey, u64, u64)>> {
    let h = load_header(ai)?;
    if h.best == IDX_NULL { return Ok(None); }
    let n = read_node(ai, h.best)?;
    Ok(Some((n.oo, n.price_ticks, n.base_qty)))
}

pub fn consume_best_by(ai: &AccountInfo<'_>, is_bid_book: bool, qty: u64) -> Result<()> {
    let h = load_header(ai)?;
    if h.best == IDX_NULL { return Ok(()); }
    let mut n = read_node(ai, h.best)?;
    if qty >= n.base_qty {
        let idx = h.best;
        let _ = bst_delete(ai, idx, is_bid_book)?;
    } else {
        n.base_qty = n.base_qty.saturating_sub(qty);
        write_node(ai, h.best, &n)?;
    }
    Ok(())
}

pub fn remove_by_oo(ai: &AccountInfo<'_>, is_bid_book: bool, target: Pubkey) -> Result<bool> {
    let h = load_header(ai)?;
    if h.root == IDX_NULL {
        return Ok(false);
    }
    let mut stack = vec![h.root];
    while let Some(idx) = stack.pop() {
        if idx == IDX_NULL { continue; }
        let n = read_node(ai, idx)?;
        if n.oo == target {
            let _ = bst_delete(ai, idx, is_bid_book)?;
            return Ok(true);
        }
        if n.left != IDX_NULL { stack.push(n.left); }
        if n.right != IDX_NULL { stack.push(n.right); }
    }
    Ok(false)
}

pub fn used_nodes(ai: &AccountInfo<'_>) -> Result<u32> {
    let h = load_header(ai)?;
    Ok(h.used)
}

pub fn capacity_nodes(ai: &AccountInfo<'_>) -> Result<u32> {
    let h = load_header(ai)?;
    Ok(h.capacity)
}
