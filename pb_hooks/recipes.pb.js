/// <reference path="../pb_data/types.d.ts" />

/**
 * 菜谱统计钩子
 *
 * 每新增一条 cook_history（做菜记录），服务端重算对应 recipes 的：
 *   cook_count（做过次数）/ avg_rating（平均分）/ last_cooked_at（最近一次）
 *
 * 【修 V1 的 bug】V1 的 addCookRecord 取「最近一次记录」时没有 ORDER BY，
 *   db 返回顺序不可靠导致 lastCookedAt 可能错；这里用 -created_at 明确排序后取第一条。
 *
 * 注意（Phase 2 实测）：顶层函数在 handler 内不可见，所有逻辑必须内联。
 */

onRecordAfterCreateSuccess((e) => {
  const rec = e.record;
  if (!rec) return;
  if (rec.tableName() !== 'cook_history') return;

  try {
    const recipeId = rec.getString('recipe');
    if (!recipeId) return;

    let recipe = null;
    try {
      recipe = $app.findRecordById('recipes', recipeId);
    } catch (err) {
      return; // 菜谱已被删除
    }

    const histories = $app.findRecordsByFilter(
      'cook_history',
      'recipe = {:rid}',
      '-created_at',
      0,
      0,
      { rid: recipeId },
    );

    const count = histories.length;
    if (count === 0) return;

    let sum = 0;
    let rated = 0;
    for (let i = 0; i < count; i++) {
      const r = histories[i].getInt('rating');
      if (r > 0) {
        sum += r;
        rated += 1;
      }
    }

    recipe.set('cook_count', count);
    if (rated > 0) {
      recipe.set('avg_rating', Math.round(sum / rated));
    }
    // 按 -created_at 排序，第一条即最近一次（修 V1 的无序取 [0]）
    recipe.set('last_cooked_at', histories[0].get('created_at'));

    $app.save(recipe);
  } catch (err) {
    $app.logger().error('[recipes] 做菜统计失败: ' + err);
  }
}, 'cook_history');
