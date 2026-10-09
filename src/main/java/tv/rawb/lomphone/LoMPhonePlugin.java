package tv.rawb.lomphone;

import com.danidipp.sneakypocketbase.PocketbaseProvider;
import io.papermc.paper.command.brigadier.BasicCommand;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import java.util.*;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.*;
import org.bukkit.plugin.IllegalPluginAccessException;
import org.bukkit.plugin.java.JavaPlugin;

public final class LoMPhonePlugin extends JavaPlugin implements Listener {
  private Runnable unregisterExpansion = () -> {};
  private Bridge bridge;
  private PhoneCommand command;
  private volatile boolean accepting;
  private int cursor;

  @Override
  public void onEnable() {
    saveDefaultConfig();
    try {
      bridge =
          new Bridge(
              PocketbaseProvider.getApi(),
              this::onMain,
              System::currentTimeMillis,
              getConfig().getString("collections.link-codes", "phone_link_codes"),
              getConfig().getString("collections.player-steps", "phone_player_steps"),
              getConfig().getLong("code-ttl-seconds", 300) * 1000,
              getConfig().getLong("refresh-seconds", 30) * 1000,
              getConfig().getLong("stale-seconds", 90) * 1000,
              getConfig().getInt("max-concurrent-requests", 8));
    } catch (IllegalArgumentException invalidConfiguration) {
      getLogger()
          .severe("Invalid bridge configuration; plugin disabled. Check config bounds in README.");
      Bukkit.getPluginManager().disablePlugin(this);
      return;
    }
    command = new PhoneCommand(bridge);
    accepting = true;
    getLifecycleManager()
        .registerEventHandler(
            LifecycleEvents.COMMANDS,
            event ->
                event
                    .registrar()
                    .register(
                        "lomphone",
                        "Create a private phone linking code",
                        new BasicCommand() {
                          @Override
                          public void execute(CommandSourceStack source, String[] args) {
                            var sender = source.getSender();
                            UUID id = sender instanceof Player player ? player.getUniqueId() : null;
                            command.execute(
                                id,
                                sender.hasPermission("lomphone.link"),
                                args,
                                reply -> {
                                  Component message = Component.text(reply.text());
                                  if (reply.clickCommand() != null)
                                    message =
                                        message.append(
                                            Component.text(" [Confirm]", NamedTextColor.YELLOW)
                                                .clickEvent(
                                                    ClickEvent.runCommand(reply.clickCommand())));
                                  sender.sendMessage(message);
                                },
                                System.currentTimeMillis());
                          }
                        }));
    Bukkit.getPluginManager().registerEvents(this, this);
    if (Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")) {
      StepsExpansion expansion = new StepsExpansion(bridge);
      unregisterExpansion = expansion::unregister;
      if (!expansion.register())
        getLogger().warning("Placeholder registration failed; phone linking remains available.");
    }
    // Poll only online UUIDs. No global scans, realtime registrations, or authentication callbacks.
    Bukkit.getScheduler()
        .runTaskTimer(
            this,
            () -> {
              var players = new ArrayList<>(Bukkit.getOnlinePlayers());
              if (!players.isEmpty()) {
                Collections.rotate(players, -(cursor++ % players.size()));
                players.forEach(player -> bridge.refresh(player.getUniqueId()));
              }
            },
            1,
            20);
  }

  private void onMain(Runnable work) {
    if (!accepting) return;
    try {
      Bukkit.getScheduler()
          .runTask(
              this,
              () -> {
                if (accepting) work.run();
              });
    } catch (IllegalPluginAccessException disabledDuringSchedule) {
      /* shutdown: discard work */
    }
  }

  @EventHandler
  public void onJoin(PlayerJoinEvent event) {
    bridge.refresh(event.getPlayer().getUniqueId());
  }

  @EventHandler
  public void onQuit(PlayerQuitEvent event) {
    command.forget(event.getPlayer().getUniqueId());
  }

  @Override
  public void onDisable() {
    accepting = false;
    if (bridge != null) bridge.stop();
    unregisterExpansion.run();
    Bukkit.getScheduler().cancelTasks(this);
  }
}
