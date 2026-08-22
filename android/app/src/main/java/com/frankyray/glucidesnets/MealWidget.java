package com.frankyray.glucidesnets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Widget « raccourcis » : chaque bouton ouvre l'app directement sur le bon
 * geste, via un paramètre ?action= que la page web sait interpréter.
 *
 * Pas de chiffres en direct ici : les données vivent dans le stockage du
 * navigateur, hors de portée d'un widget natif. Les afficher demanderait
 * une session Supabase côté Android — hors de proportion pour l'instant.
 */
public class MealWidget extends AppWidgetProvider {

    private static final String BASE = "https://frankyray21.github.io/Calcul-glucide/";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget);
            views.setOnClickPendingIntent(R.id.btn_photo,   open(context, 1, "photo"));
            views.setOnClickPendingIntent(R.id.btn_calc,    open(context, 2, "meal"));
            views.setOnClickPendingIntent(R.id.btn_discuss, open(context, 3, "discuss"));
            views.setOnClickPendingIntent(R.id.btn_journal, open(context, 4, "journal"));
            manager.updateAppWidget(id, views);
        }
    }

    private PendingIntent open(Context context, int code, String action) {
        Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse(BASE + "?action=" + action), context, LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, code, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
